// Copyright
/**
 * Aliyun OSS SDK implemented with TypeScript for Deno
 * 
 */

import { ClientConfig } from "./common.ts";

import { Bucket, BucketOperation, ListBucketsOptions, BucketInfo, ListObjectsQuery, ListObjectsResult } from "./bucket.ts";
import { ObjectOperation, PutObjectOptions, PutObjectResult, HeadObjectOptions } from "./object.ts";
/**
 * Options for oss client
 */
export interface ClientOptions {
    /**
     * Send request over HTTPS protocol or not. default value is `true`.
     */
    secure?: boolean;

    /**
     * Use cname instead of aliyun regular endpoint. default value is `false`.
     */
    cname?: boolean;

    /**
     * Operation timeout settings in milliseconds. If this property is left `undefined` or set to invalid number, request will no be timeout.
     */
    timeoutMs?: number;
}

export class OssClient {
    #region: string;
    #endpoint: string;
    #accessKeyId: string;
    #accessKeySecret: string;
    
    #options: ClientOptions;

    #defaultOptions: ClientOptions = {
        secure: true,
        cname: false,
    };

    #bucketOperations: BucketOperation;
    #objectOperations: ObjectOperation;


    /**
     * Constructor for OssClient.
     *
     * - `region`: The region. e.g. `cn-hangzhou`, `cn-beijing`. region is region id without `oss-` prefix.
     * - `endpoint`: The endpoint to connect to. e.g. `oss-cn-zhangjiakou.aliyuncs.com` for internet, `oss-cn-zhangjiakou-internal.aliyuncs.com` for VPC.
     * 
     * @param {string}        region
     * @param {string}        endpoint       
     * @param {string}        accessKeyId     
     * @param {string}        accessKeySecret 
     * @param {ClientOptions} options         
     */
    constructor(region: string, endpoint: string, accessKeyId: string, accessKeySecret: string, options?: ClientOptions) {
        this.#region = region;
        this.#endpoint = endpoint;
        this.#accessKeyId = accessKeyId;
        this.#accessKeySecret = accessKeySecret;
        this.#options = Object.assign({}, this.#defaultOptions, options);

        const clientConfig = {
            region: this.#region,
            endpoint: this.#endpoint,
            accessKeyId: this.#accessKeyId,
            accessKeySecret: this.#accessKeySecret,
            secure: this.#defaultOptions.secure,
            cname: this.#defaultOptions.cname,
            timeoutMs: this.#defaultOptions.timeoutMs
        };
        
        this.#bucketOperations = new BucketOperation(clientConfig);
        this.#objectOperations = new ObjectOperation(clientConfig);
    }

    #getClientConfig(): ClientConfig {
        return {
            region: this.#region,
            endpoint: this.#endpoint,
            accessKeyId: this.#accessKeyId,
            accessKeySecret: this.#accessKeySecret,
            secure: this.#defaultOptions.secure,
            cname: this.#defaultOptions.cname,
            timeoutMs: this.#defaultOptions.timeoutMs
        };
    }

    /**
     * List buckets
     */
    listBuckets(options?: ListBucketsOptions): Promise<Bucket[]> {
        return this.#bucketOperations.listBuckets(options);
    }
    
    /* List all buckets. If there are so many buckets, the client will request multiple times to get complete bucket list */
    listAllBuckets(): Promise<Bucket[]> {
        return this.#bucketOperations.listAllBuckets();
    }

    getBucketInfo(bucketName: string): Promise<BucketInfo> {
        return this.#bucketOperations.getBucketInfo(bucketName);
    }

    listObjects(bucketName: string, query?: ListObjectsQuery): Promise<ListObjectsResult> {
        return this.#bucketOperations.listObjects(bucketName, query);
    }

    createFolder(bucketName: string, folderPath: string): Promise<void> {
        return this.#objectOperations.createFolder(bucketName, folderPath);
    }

    // putFile(bucketName: string, objectKey: string, file: Deno.FsFile, options?: PutObjectOptions): Promise<PutObjectResult> {
    //     return this.#objectOperations.putFile(bucketName, objectKey, file, options);
    // }

    putObject(bucketName: string, objectKey: string, filePath: string, options?: PutObjectOptions): Promise<PutObjectResult> {
        return this.#objectOperations.putObject(bucketName, objectKey, filePath, options);
    }

    headObject(bucketName: string, objectKey: string, options?: HeadObjectOptions): Promise<Record<string, string>> {
        return this.#objectOperations.headObject(bucketName, objectKey, options);
    }
};