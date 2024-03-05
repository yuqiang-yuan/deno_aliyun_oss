// Copyright
/**
 * Aliyun OSS SDK implemented with TypeScript for Deno
 * 
 */

import { ClientConfig } from "./common.ts";

import { Bucket, BucketOperation, ListBucketsOptions, ListBucketsQuery, BucketInfo } from "./bucket.ts";

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
    listBuckets(query?: ListBucketsQuery, options?: ListBucketsOptions): Promise<Bucket[]> {
        return this.#bucketOperations.listBuckets(query, options);
    }
    
    /* List all buckets. If there are so many buckets, the client will request multiple times to get complete bucket list */
    listAllBuckets(options?: ListBucketsOptions): Promise<Bucket[]> {
        return this.#bucketOperations.listAllBuckets(options);
    }

    getBucketInfo(bucketName: string): Promise<BucketInfo> {
        return this.#bucketOperations.getBucketInfo(bucketName);
    }
};