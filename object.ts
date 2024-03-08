import { crypto } from "std/crypto/mod.ts";
import { encodeBase64 } from "std/encoding/base64.ts";
import { contentType } from "std/media_types/content_type.ts";
import { extname } from "std/path/mod.ts";

import { parse as parseXml } from "xml/mod.ts";

import { ClientConfig, RequestConfig, ClientError, HttpMethod } from "./common.ts";
import { Operation } from "./operation.ts";
import { isBlank, log, camelToKebab } from "./helper.ts";

/**
 * Put object request. 
 * See [Official Document](https://help.aliyun.com/zh/oss/developer-reference/putobject?spm=a2c4g.11186623.0.0.730f4478jfQuVL) 
 * for more details.
 */
export interface PutObjectOptions {
    /**
     * 指定该 Object 被下载时网页的缓存行为。选填项。取值如下：
     *
     * - `no-cache`：不可直接使用缓存，而是先到服务端验证 Object 是否已更新。如果 Object 已更新，表明缓存已过期，需从服务端重新下载 Object；如果 Object 未更新，表明缓存未过期，此时将使用本地缓存。
     * - `no-store`：所有内容都不会被缓存。
     * - `public`：所有内容都将被缓存。
     * - `private`：所有内容只在客户端缓存。
     * - `max-age=<seconds>`：缓存内容的相对过期时间，单位为秒。此选项仅在 HTTP 1.1 中可用。
     */
    cacheControl?: string;

    /**
     * 指定 Object 的展示形式。选填项。取值如下：
     *
     * - `Content-Disposition:inline`：直接预览文件内容。
     * - `Content-Disposition:attachment`：以原文件名的形式下载到浏览器指定路径。
     * - `Content-Disposition:attachment; filename="yourFileName"`：以自定义文件名的形式下载到浏览器指定路径。
     * 
     * `yourFileName` 用于自定义下载后的文件名称，例如 `example.jpg`。
     * 将 Object 下载到浏览器指定路径时：
     * 
     * **说明**
     *
     * - 如果 Object 名称包含星号（`*`）、正斜线（`/`）等特殊字符时，可能会出现特殊字符转义的情况。例如，下载 `example*.jpg` 到本地时，`example*.jpg` 可能会转义为 `example_.jpg`。
     * - 如需确保下载名称中包含中文字符的 Object 到本地指定路径后，文件名称不出现乱码的现象，您需要将名称中包含的中文字符进行 URL 编码。例如，将`测试.txt` 从 OSS 下载到本地后，需要保留文件名为`测试.txt`，需按照`"attachment;filename="+URLEncoder.encode("测试","UTF-8")+".txt;filename*=UTF-8''"+URLEncoder.encode("测试","UTF-8")+".txt"` 的格式设置 `Content-Disposition`，即 `attachment;filename=%E6%B5%8B%E8%AF%95.txt;filename*=UTF-8''%E6%B5%8B%E8%AF%95.txt`。
     * - 通过文件 URL 访问文件时是预览还是以附件形式下载，与文件所在 Bucket 的创建时间、OSS 开通时间以及使用的域名类型有关。更多信息，请参见 [通过文件 URL 访问文件无法预览而是以附件形式下载？](https://help.aliyun.com/zh/oss/images-downloaded-as-an-attachment-instead-of-being-previewed-by-using-a-url#concept-2331929)。
     */
    contentDisposition?: string;

    /**
     * 声明 Object 的编码方式。您需要按照 Object 的实际编码类型填写，否则可能造成客户端（浏览器）解析编码失败或 Object 下载失败。若 Object 未编码，请置空此项。取值如下：
     *
     * - `identity`（默认值）：表示 Object 未经过压缩或编码。
     * - `gzip`：表示Object采用 Lempel-Ziv（LZ77）压缩算法以及 32 位 CRC 校验的编码方式。
     * - `compress`：表示 Object 采用 Lempel-Ziv-Welch（LZW）压缩算法的编码方式。
     * - `deflate`：表示 Object 采用 zlib 结构和 deflate 压缩算法的编码方式。
     * - `br`：表示 Object 采用 Brotli 算法的编码方式。
     */
    contentEncoding?: "identity" | "gzip" | "compress" | "deflate" | "br";

    /**
     * 文件的 MIME Type，例如： `image/png`。通常不需要调用者设置，SDK 会根据文件扩展名判断类型
     */
    contentType?: string;

    /**
     * 文件大小，以字节为单位。通常不需要调用者设置，SDK 会读取文件大小信息
     */
    contentLength?: bigint;

    /**
     * 文件内容 MD5 摘要的 Base64 字符串形式，通常不需要调用者设置，SDK 会读取文件内容并计算 MD5 值。
     */
    contentMd5?: string;

    /**
     * 缓存内容的绝对过期时间，格式是格林威治时间（GMT）。
     */
    expires?: string;

    /**
     * 指定 PutObject 操作时是否覆盖同名 Object。 
     * 当目标 Bucket 处于已开启或已暂停的版本控制状态时，`x-oss-forbid-overwrite` 请求 Header 设置无效，即允许覆盖同名 Object。
     *
     * - 不指定 `x-oss-forbid-overwrite` 或者指定 `x-oss-forbid-overwrite` 为 `false` 时，表示允许覆盖同名 Object。
     * - 指定 `x-oss-forbid-overwrite` 为 `true` 时，表示禁止覆盖同名 Object。
     *
     * 设置 `x-oss-forbid-overwrite` 请求 Header 会导致 QPS 处理性能下降，
     * 如果您有大量的操作需要使用 `x-oss-forbid-overwrite` 请求 Header（QPS>1000），请联系技术支持，避免影响您的业务。
     *
     * 默认值：`false`
     */
    forbidOverwrite?: boolean;

    /**
     * 指定服务器端的加密方式
     */
    serverSideEncryption?: "AES256" | "KMS" | "SM4";

    /**
     * 指定 Object 的加密算法。仅在 `serverSideEncryption` (请求头 `x-oss-server-side-encryption`) 为 `KMS` 时有效。
     */
    serverSideDataEncryption?: "SM4";

    /**
     * KMS托管的用户主密钥。仅在 `serverSideEncryption` (请求头 `x-oss-server-side-encryption`) 为 `KMS` 时有效。
     */
    serverSideEncryptionKeyId?: string;

    /**
     * Object 的访问权限
     */
    objectAcl?: "default" | "private" | "public-read" | "public-read-write";

    /**
     * Object 的存储类型。
     *
     * 对于任意存储类型的 Bucket，如果上传 Object 时指定此参数，则此次上传的 Object 将存储为指定的类型。
     * 例如在 IA 类型的 Bucket 中上传 Object 时，如果指定 `storageClass` (请求头 `x-oss-storage-class` ) 为 `Standard`，
     * 则该 Object 直接存储为 `Standard`。
     */
    storageClass?: "IA" | "Archive" | "ColdArchive" | "DeepColdArchive";

    /**
     * 以键值对（Key-Value）的形式指定 Object 的标签信息，可同时设置多个标签。
     */
    tagging?: Record<string, string | number | boolean>;

    /**
     * Object 的用户自定义元数据。
     *
     * 元数据支持短划线（`-`）、数字、英文字母（`a~z`）。英文字符的大写字母会被转成小写字母，不支持下划线（`_`）在内的其他字符。
     */
    meta?: Record<string, string | number | boolean>;

    /**
     * 回调配置
     */
    callback?: CallbackOptions;

    /**
     * 回调中需要使用的自定义参数。自定义参数的 key 以 `x:` 开始。
     * 例如：`x:var1` = `value1`
     */
    callbackVariables?: Record<string, string>;
}

/**
 * PutObject, PostObject 和 CompleteMultipartUpload 请求中，
 * 可以设定自定义的 callback 
 *
 * 详细的参数请参考 [官方文档](https://help.aliyun.com/zh/oss/developer-reference/callback)
 */
export interface CallbackOptions {
    /**
     * 文件上传成功后，OSS 向此 URL 发送回调请求。
     * - 请求方法为 `POST` ，Body 为 `body` 指定的内容。
     *   正常情况下，该URL需要响应 `HTTP/1.1 200 OK`，响应 Body 必须为 JSON 格式，响应头 `Content-Length` 必须为合法的值，且大小不超过 3 MB。
     * - 支持同时配置最多 5 个 URL，多个 URL 间以分号（`;`）分隔。OSS 会依次发送请求，直到第一个回调请求成功返回。
     * - 支持 HTTPS 地址。
     * - 为了保证正确处理中文等情况，`url` 需做 URL 编码处理，
     * 例如 `http://example.com/中文.php?key=value&中文名称=中文值` 
     * 需要编码为 `http://example.com/%E4%B8%AD%E6%96%87.php?key=value&%E4%B8%AD%E6%96%87%E5%90%8D%E7%A7%B0=%E4%B8%AD%E6%96%87%E5%80%BC`。
     */
    url: string;

    /**
     * 发起回调请求时 `Host` 头的值，格式为域名或 IP 地址。
     * 如果不配置 `host`，那么 OSS 会通过解析 `url` 来得到 Host
     */
    host?: string;

    /**
     * 发起回调时请求 Body 的值，例如 `key=${object}&etag=${etag}&my_var=${x:my_var}`
     */
    body: string;

    /**
     * 客户端发起回调请求时，OSS 是否向通过 callbackUrl 指定的回源地址发送服务器名称指示 SNI（Server Name Indication）。
     * 是否发送 SNI 取决于服务器的配置和需求。对于使用同一个IP地址来托管多个 TLS/SSL 证书的服务器的情况，建议选择发送SNI。
     */
    sni?: boolean;

    /**
     * 发起回调请求的 `Content-Type`
     */
    bodyType?: "application/x-www-form-urlencoded" | "application/json";
}

/**
 * Put object result
 */
export interface PutObjectResult {
    /**
     * 文件的内容的 MD5 摘要结果，Base64 格式的字符串
     */
    contentMd5: string;

    /**
     * 文件的 CRC64 值
     */
    crc64?: string;

    /**
     * 表示文件的版本 ID。仅当您将文件上传至已开启版本控制状态的 Bucket 时，才会有此返回值
     */
    versionId?: string;
}


export interface HeadObjectOptions {
    /**
     * 如果传入参数中的时间早于实际修改时间，则返回 200 OK 和 Object Meta；否则抛出 ClientError, status = 304 Not Modified。
     */
    ifModifiedSince?: string;

    /**
     * 如果传入参数中的时间等于或者晚于文件实际修改时间，则返回 200 OK 和 Object Meta；否则抛出 ClientError, status = 412 Precondition Failed。
     */
    ifUnmodifiedSince?: string;

    /**
     * 如果传入期望的 ETag 和 Object 的 ETag 匹配，则返回 200 OK 和 Object Meta；否则抛出 ClientError, status = 412 precondition failed。
     */
    ifMatch?: string;

    /**
     * 如果传入期望的 ETag 值和 Object 的 ETag 不匹配，则返回 200 OK 和 Object Meta；否则抛出 ClientError, status = 304 Not Modified。
     */
    ifNoneMatch?: string;
}

export interface GetObjectOptions {
    responseContentType?: string;
    responseContentLanguage?: string;
    responseExpires?: string;
    responseCacheControl?: string;
    responseContentDisposition?: string;
    responseContentEncoding?: string;

    /**
     * 如果传入参数中的时间早于实际修改时间，则返回 200 OK 和 Object Meta；否则抛出 ClientError, status = 304 Not Modified。
     */
    ifModifiedSince?: string;

    /**
     * 如果传入参数中的时间等于或者晚于文件实际修改时间，则返回 200 OK 和 Object Meta；否则抛出 ClientError, status = 412 Precondition Failed。
     */
    ifUnmodifiedSince?: string;

    /**
     * 如果传入期望的 ETag 和 Object 的 ETag 匹配，则返回 200 OK 和 Object Meta；否则抛出 ClientError, status = 412 precondition failed。
     */
    ifMatch?: string;

    /**
     * 如果传入期望的 ETag 值和 Object 的 ETag 不匹配，则返回 200 OK 和 Object Meta；否则抛出 ClientError, status = 304 Not Modified。
     */
    ifNoneMatch?: string;

    /**
     * 是否对响应内容进行 gzip 压缩。
     * 如果采用了Gzip压缩，则不会附带ETag信息。
     * 目前 OSS 支持 Gzip 压缩的 Content-Type 为 
     * `text/cache-manifest`、 `text/xml`、`text/plain`、`text/css`、
     * `application/javascript`、`application/x-javascript`、`application/rss+xml`、`application/json和text/json`。
     */
    // gzipResponse?: boolean;
}

export interface DeleteObjectOptions {
    /**
     * 删除指定 `versionId` 的 Object。
     * 如果要删除 ID 为 `null` 的版本，请将此参数设置为字符串 `"null"`。
     */
    versionId?: string;
}

export interface SignatureOptions {
    /**
     * 有效期多少秒
     */
    ttlSeconds: number;

    /**
     * 如果是生成上传 URL，这里指要上传的内容的 Content-Type
     */
    contentType?: string;

    /**
     * 图片处理。例如：`image/resize,w_200`
     */
    process?: string;

    responseContentType?: string;
    responseContentLanguage?: string;
    responseCacheControl?: string;
    responseExpires?: string;
    responseContentDisposition?: string;
    responseContentEncoding?: string;

    /**
     * 其他需要包含在签名 URL 中的参数
     */
    additionalParameters?: Record<string, string>;
}

export interface GetObjectMetaOptions {
    versionId?: string;
}

export interface GetObjectMetaResult {
    /**
     * Object 的文件大小，单位为字节。
     */
    contentLength: number;

    /**
     * Object 生成时会创建 ETag（entity tag），ETag 用于标识一个 Object 的内容。
     * 
     * 对于通过 PutObject 请求创建的 Object，ETag 值是其内容的 MD5 值；
     * 对于其他方式创建的 Object，ETag 值是基于一定计算规则生成的唯一值，但不是其内容的 MD5 值。
     * ETag 值可以用于检查 Object 内容是否发生变化。不建议用户使用 ETag 作为 Object 内容的 MD5 校验来验证数据完整性。
     */
    etag: string;

    /**
     * Object 的最后一次访问时间。
     * 开启访问跟踪时，该字段的值会随着文件被访问的时间持续更新。
     * 如果开启后关闭了访问跟踪，该字段的值保留为上一次最后更新的值。
     */
    lastAccessTime?: Date;

    /**
     * Object 最后一次修改时间
     */
    lastModified?: Date;

    /**
     * Object的版本ID。只有查看Object指定版本的元数据信息时才显示该字段
     */
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
     * 创建文件夹。
     *
     * `folderPath` 是文件夹对应的 Object Key。不包含开头的 `/` 和结尾的 `/`。例如： `foo/bar/new_folder`。
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
     * 将 Stream 上传到 OSS。
     *
     * 如果要使用此方法上传 Object， 必需设置 `options` 中的 `contentType`, `contentLength` 和 `contentMd5` (base64 字符串格式)。
     * 
     */
    async putStream(bucketName: string, objectKey: string, stream: ReadableStream, options?: PutObjectOptions): Promise<PutObjectResult | string> {
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

        const callback = options?.callback;
        const callbackVariables = options?.callbackVariables;

        // const query: Record<string, string> = {};
        if (callback) {
            const { url, host, body, bodyType, sni} = callback;
            const callbackObj: Record<string, string> = {
                callbackUrl: url,
                callbackBody: body,
            };

            if (host) {
                callbackObj.callbackHost = host;
            }

            if (bodyType) {
                callbackObj.callbackBodyType = bodyType;
            }

            if (sni !== undefined) {
                callbackObj.callbackSNI = `${sni}`;
            }
            
            const s = JSON.stringify(callbackObj);

            headers["x-oss-callback"] = encodeBase64((new TextEncoder()).encode(s));
        }

        if (callbackVariables) {
            const s = JSON.stringify(callbackVariables);
            headers["x-oss-callback-var"] = encodeBase64((new TextEncoder()).encode(s));
        }

        const requestConfig: RequestConfig = {
            method: "PUT",
            bucketName,
            objectKey: sanitizedObjectKey,
            headers,
            body: stream,
        };

        const { headers: responseHeaders, content } = await super.doRequest(requestConfig);

        if (callback) {
            return content!;
        }

        return {
            contentMd5: responseHeaders["content-md5"],
            crc64: responseHeaders["x-oss-hash-crc64ecma"],
            versionId: responseHeaders["x-oss-version-id"]
        };
    }

    /**
     * 上传 Object。
     *
     * `objectKey` 无需包含签到的斜线（`/`）。例如：`foo/bar/example.png`。
     *
     * 如果上传文件的时候指定了 `callback` 选项，那么返回值是 OSS 调用 callback 之后返回的内容字符串
     */
    async putObject(bucketName: string, objectKey: string, filePath: string, options?: PutObjectOptions): Promise<PutObjectResult | string> {
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

    /**
     * 获取某个 Object 的元数据。
     *
     * 返回的结果就是服务响应头，Key 值小写。
     * 具体参考 [官方文档](https://help.aliyun.com/zh/oss/developer-reference/headobject?spm=a2c4g.11186623.0.0.1e314d4dJYcyA6)。
     */
    async headObject(bucketName: string, objectKey: string, options?: HeadObjectOptions): Promise<Record<string, string>> {
        if (isBlank(bucketName) || isBlank(objectKey)) {
            throw new ClientError("bucketName and objectKey are required, can not be empty");
        }

        const headers: Record<string, string> = {};
        Object.entries(Object.assign({}, options)).forEach(([k, v]) => headers[camelToKebab(k)] = v);

        const requestConfig: RequestConfig = {
            method: "HEAD",
            bucketName,
            objectKey,
            headers
        };

        const { headers: responseHeaders } = await super.doRequest(requestConfig);
        return responseHeaders;
    }

    async getObjectMeta(bucketName: string, objectKey: string, options?: GetObjectMetaOptions): Promise<GetObjectMetaResult> {
        if (isBlank(bucketName) || isBlank(objectKey)) {
            throw new ClientError("bucketName and objectKey are required, can not be empty");
        }

        const query: Record<string, string | null> = {
            "objectMeta": null,
        }

        if (options?.versionId) {
            query["versionId"] = options!.versionId;
        }

        const requestConfig: RequestConfig = {
            method: "HEAD",
            bucketName,
            objectKey,
            query
        };

        const { headers: responseHeaders } = await super.doRequest(requestConfig);
        
        const result: GetObjectMetaResult = {
            contentLength: parseInt(`${responseHeaders["content-length"]}`),
            etag: responseHeaders["etag"],
        };

        if (responseHeaders["x-oss-last-access-time"]) {
            result.lastAccessTime = new Date(responseHeaders["x-oss-last-access-time"]);
        }

        if (responseHeaders["last-modified"]) {
            result.lastModified = new Date(responseHeaders["last-modified"]);
        }

        if (responseHeaders["x-oss-version-id"]) {
            result.versionId = responseHeaders["x-oss-version-id"];
        }

        return result;
    }

    /**
     * 下载 Object 存储到本地文件。
     * `localFilepath` 需是一个具有写入权限的文件全路径，例如：`/foo/bar/test.png`。
     * 
     */
    async getObject(bucketName: string, objectKey: string, localFilepath: string, options?: GetObjectOptions): Promise<void> {
        if (isBlank(bucketName) || isBlank(objectKey)) {
            throw new ClientError("bucketName and objectKey are required, can not be empty");
        }

        const headers: Record<string, string> = {};
        Object.entries(Object.assign({}, options))
            .forEach(([k, v]) => headers[camelToKebab(k)] = v);

        // if (options?.gzipResponse) {
        //     headers["accept-encoding"] = "gzip";
        // }    

        const requestConfig: RequestConfig = {
            method: "GET",
            bucketName,
            objectKey,
            headers,
        };

        const response = await super.sendRequest(requestConfig);

        response.headers.forEach((v, k) => {
            log(`< headers: ${k}: ${v}`);
        });

        const status = response.status;

        if (status !== 200) {
            const content = await response.text();
            if (content) {
                throw ClientError.fromResponseContent(content);
            } else {
                throw new ClientError(`Status code is not OK ${status}`, undefined, undefined, undefined, undefined, undefined, undefined, status);
            }
        }

        if (response.body === null) {
            throw new ClientError("null respnose body");
        }

        const file = await Deno.create(localFilepath);

        log(`start downloading ${bucketName}, ${objectKey} to ${localFilepath}`);
        await response.body.pipeTo(file.writable);

        log(`${bucketName}, ${objectKey} to ${localFilepath} done`);
    }

    async deleteObject(bucketName: string, objectKey: string, options?: DeleteObjectOptions) {
        if (isBlank(bucketName) || isBlank(objectKey)) {
            throw new ClientError("bucketName and objectKey are required, can not be empty");
        }

        const query: Record<string, string> = {};
        if (options?.versionId) {
            query["versionId"] = options?.versionId;
        }

        const requestConfig: RequestConfig = {
            method: "DELETE",
            bucketName,
            objectKey,
            query
        };

        await super.doRequest(requestConfig);
    }

    /**
     * 生成预签名的 URL。
     * 大部分情况下，预签名的 URL 都是为了实现 `GET` 请求，所以在签名过程中，`host` 没有参与签名。
     * 方便针对签名后的 URL 替换 hostname 为 CDN 地址、自定义域名等。
     *
     * 其他请求方式的预签名 URL 还没有测试，请谨慎使用。
     */
    signatureUrl(method: HttpMethod, bucketName: string, objectKey: string, options: SignatureOptions): Promise<string> {
        if (isBlank(method) || isBlank(bucketName) || isBlank(objectKey)) {
            throw new ClientError("method, bucketName and objectKey are required, can not be empty");
        }

        const headers: Record<string, string> = {};

        if (options.contentType) {
            headers["content-type"] = options.contentType;
        }
        
        const query: Record<string, string> = {
            "x-oss-expires": `${options.ttlSeconds}`
        };

        if (options.process) {
            query["x-oss-process"] = options.process;
        }

        Object.entries(options).filter(([k, _]) => k.startsWith("response")).forEach(([k, v]) => query[camelToKebab(k)] = v);

        if (options.additionalParameters) {
            Object.entries(options.additionalParameters).forEach(([k, v]) => query[k] = v);
        }

        const requestConfig: RequestConfig = {
            method,
            bucketName,
            objectKey,
            headers,
            query
        };

        return super.generatePresignedUrl(requestConfig);
    }


}





