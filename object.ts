import { crypto } from "std/crypto/mod.ts";
import { encodeBase64 } from "std/encoding/base64.ts";
import { contentType } from "std/media_types/content_type.ts";
import { extname } from "std/path/mod.ts";

import { parse as parseXml } from "xml/mod.ts";

import { ClientConfig, CommonOptions, RequestConfig, ClientError } from "./common.ts";
import { Operation } from "./operation.ts";
import { isBlank } from "./helper.ts";


/**
 * Put object request
 */
export interface PutObjectOptions extends CommonOptions {
    cacheControl?: string;
    contentDisposition?: string;
    contentEncoding?: string;
    contentType?: string;
    contentLength?: bigint;
    contentMd5?: string;
    expires?: string;
    forbidOverwrite?: boolean;
    serverSideEncryption?: "AES256" | "KMS" | "SM4";
    serverSideDataEncryption?: "SM4";
    serverSideEncryptionKeyId?: string;
    objectAcl?: "default" | "private" | "public-read" | "public-read-write";
    storageClass?: "IA" | "Archive" | "ColdArchive" | "DeepColdArchive";
    tagging?: Record<string, string | number | boolean>;
    meta?: Record<string, string | number | boolean>
}

/**
 * Put object result
 */
export interface PutObjectResult {
    /**
     * Content MD5 in base64 string format
     */
    contentMd5: string;

    crc64?: string;
    versionId?: string;
}

/**
 * Object operations
 */
export class ObjectOperation extends Operation {
    constructor(clientConfig: ClientConfig) {
        super(clientConfig);
    }

    /**
     * 
     * @param bucketName The bucket name
     * @param folderPath The full folder path: `foo/bar/new_folder/`. no prefix `/` but with appended `/`
     */
    async createFolder(bucketName: string, folderPath: string) {
        if (isBlank(bucketName) || isBlank(folderPath)) {
            throw new ClientError("invalid bucket name or folder path to create a new folder");
        }

        let objectKey = folderPath;
        if (objectKey.startsWith("/")) {
            objectKey = objectKey.substring(1);
        }

        if (!objectKey.endsWith("/")) {
            objectKey = `${objectKey}/`;
        }

        const requestConfig: RequestConfig = {
            method: "PUT",
            bucketName,
            objectKey,
        };

        await super.doRequest(requestConfig);
    }

    /**
     * If you call this method to put object, please do NOT forget to close the `stream`
     * and `contentType`, `contentLength` and `contentMd5` (in base64 string) must be set
     */
    async putStream(bucketName: string, objectKey: string, stream: ReadableStream, options?: PutObjectOptions): Promise<PutObjectResult> {
        if (isBlank(bucketName) || isBlank(objectKey)) {
            throw new ClientError("invalid bucket name or folder path to put object");
        }
        
        let sanitizedObjectKey = objectKey;
        if (sanitizedObjectKey.startsWith("/")) {
            sanitizedObjectKey = sanitizedObjectKey.substring(1);
        }
        
        const headers: Record<string, string> = {};
        if (options?.contentType) {
            headers["content-type"] = options!.contentType;
        }

        if (options?.contentLength) {
            headers["content-length"] = `${options!.contentLength}`;
        }

        if (options?.contentMd5) {
            headers["content-md5"] = options!.contentMd5;
        }

        if (options?.cacheControl) {
            headers["cache-control"] = options!.cacheControl;
        }

        if (options?.contentDisposition) {
            headers["content-disposition"] = options!.contentDisposition;
        }

        if (options?.contentEncoding) {
            headers["content-encoding"] = options!.contentEncoding;
        }

        if (options?.expires) {
            headers["expires"] = options!.expires;
        }

        if (options?.forbidOverwrite) {
            headers["x-oss-forbid-overwrite"] = `${options!.forbidOverwrite}`;
        }

        if (options?.serverSideEncryption) {
            headers["x-oss-server-side-encryption"] = options!.serverSideEncryption;
        }

        if (options?.serverSideDataEncryption) {
            headers["x-oss-server-side-data-encryption"] = options!.serverSideDataEncryption;
        }

        if (options?.serverSideEncryptionKeyId) {
            headers["x-oss-server-side-encryption-key-id"] = options!.serverSideEncryptionKeyId;
        }

        if (options?.objectAcl) {
            headers["x-oss-object-acl"] = options!.objectAcl;
        }

        if (options?.storageClass) {
            headers["x-oss-storage-class"] = options!.storageClass;
        }

        if (options?.meta) {
            Object.entries(options!.meta).forEach(([k, v]) => headers[`x-oss-meta-${k.toLocaleLowerCase()}`] = `${v}`);
        }

        if (options?.tagging) {
            headers["x-oss-tagging"] = Object.entries(options!.tagging).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
        }

        const requestConfig: RequestConfig = {
            method: "PUT",
            bucketName,
            objectKey: sanitizedObjectKey,
            headers,
            body: stream,
        };

        const { headers: responseHeaders } = await super.doRequest(requestConfig);
        return {
            contentMd5: responseHeaders["content-md5"],
            versionId: responseHeaders["x-oss-version-id"]
        };
    }

    /**
     * put a file to oss
     */
    async putFile(bucketName: string, objectKey: string, filePath: string, options?: PutObjectOptions): Promise<PutObjectResult> {
        if (isBlank(filePath)) {
            throw new ClientError("filePath must NOT be emtpy");
        }

        let file: Deno.FsFile | undefined = undefined;

        try {
            file = await Deno.open(filePath);
            const stat = await file.stat();
            if (!stat.isFile) {
                throw new ClientError(`${filePath} is not a regular file`);
            }

            if (stat.size === 0) {
                throw new ClientError(`${filePath} length is 0, can not put to OSS as a regular file`);
            }
            const [s0, s1] = file.readable.tee();
            const contentMd5 = encodeBase64(await crypto.subtle.digest("MD5", s1));
            const ext = extname(filePath);
            const mime = contentType(ext);

            const opt = Object.assign({
                contentMd5,
                contentLength: `${stat.size}`,
            }, options);

            if (mime) {
                opt.contentType = mime;
            }
            return await this.putStream(bucketName, objectKey, s0, opt);
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                throw new ClientError(`can not find file ${filePath}`);
            }

            if (e instanceof Deno.errors.PermissionDenied) {
                throw new ClientError(`can not read file ${filePath}`);
            }

            throw e;
        } finally {
            if (file !== null) {
                try {
                    file?.close();
                } catch (_e) {
                    // ignore BadResource: Bad resource ID when the stream has been read
                }
            }
        }
    }
}