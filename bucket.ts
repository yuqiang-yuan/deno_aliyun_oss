import { parse as parseXml } from "xml/mod.ts";

import { ClientConfig, CommonOptions, RequestConfig } from "./common.ts";
import { Operation } from "./operation.ts";
import { camelToKebab } from "./helper.ts";

/**
 * List buckets query parameters.
 * See [Official Documents](https://help.aliyun.com/zh/oss/developer-reference/listbuckets?spm=a2c4g.11186623.0.0.1b0ab930SHOdG9) for more details.
 */
export interface ListBucketsQuery {
    prefix?: string;
    marker?: string;
    maxKeys?: number;

    resourceGroupId?: string;
};

/**
 * Simple information of a bucket
 */
export interface Bucket {
    name: string;
    comment?: string;
    creationDate: Date;
    location: string;
    region: string;
    extranetEndpoint: string;
    intranetEndpoint: string;
    storageClass: string;
    resourceGroupId?: string;
}

/**
 * List buckets query response.
 * See [Official Documents](https://help.aliyun.com/zh/oss/developer-reference/listbuckets?spm=a2c4g.11186623.0.0.1b0ab930SHOdG9) for more details.
 */
export interface ListBucketsResult {
    prefix?: string;
    marker?: string;
    maxKeys?: number;
    isTruncated?: boolean;
    nextMarker?: string;
    buckets: Bucket[];
}

export type ListBucketsOptions = CommonOptions;

/**
 * Bucket detail information
 */
export interface BucketInfo extends Bucket {
    accessControlList: {
        grant: string;
    };

    serverSideEncryptionRule: {
        sseAlgorithm: string;
    };

    blockPublicAccess: boolean;
    dataRedundancyType: string;
    accessMonitor: string;
    versioning?: string;
    kmsMasterKeyId?: string;
    crossRegionReplication: string;
    transferAcceleration: string;
    bucketPolicy: {
        logBucket: string;
        logPrefix: string;
    }
};

/**
 * List object query parameters
 * See [Official Document](https://help.aliyun.com/zh/oss/developer-reference/listobjectsv2?spm=a2c4g.11186623.0.0.2e09d37eaJFStJ) for more details.
 */
export interface ListObjectsQuery {
    delimiter?: string;
    startAfter?: string;
    continuationToken?: string;
    maxKeys?: number;
    prefix?: string;
    encodingType?: string;
    fetchOwner?: boolean;
};

export interface ListObjectsContent {
    key: string;
    lastModified: Date;
    eTag: string;
    type: string;
    size: number;
    storageClass: string;
    restoreInfo?: string;
};

export interface ListObjectsResult {
    name: string;
    prefix?: string;
    maxKeys?: number;
    delimiter?: string;
    isTruncated?: boolean;
    nextContinuationToken?: string;
    keyCount?: number;
    commonPrefixes?: string[],
    contents?: ListObjectsContent[]
}

export class BucketOperation extends Operation {
    constructor(clientConfig: ClientConfig) {
        super(clientConfig);
    }

    /**
     * List buckets which satisfied query.
     * See [Official Documents](https://help.aliyun.com/zh/oss/developer-reference/listbuckets?spm=a2c4g.11186623.0.0.1b0ab930SHOdG9) for more details.
     */
    async #listBuckets(query?: ListBucketsQuery, options?: ListBucketsOptions): Promise<ListBucketsResult> {
        const { prefix, marker, maxKeys, resourceGroupId } = Object.assign({}, query);

        const requestQuery: Record<string, string> = {};
        if (prefix) {
            requestQuery.prefix = prefix;
        }

        if (marker) {
            requestQuery.marker = marker;
        }

        if (maxKeys) {
            requestQuery["max-keys"] = `${maxKeys}`;
        }

        const requestHeaders: Record<string, string> = {};
        if (resourceGroupId) {
            requestHeaders["x-oss-resource-group-id"] = resourceGroupId;
        }

        const { timeoutMs } = Object.assign({}, options);

        const requestConfig: RequestConfig = {
            method: "GET",
            query: requestQuery,
            headers: requestHeaders,
            options: {
                timeoutMs
            }
        };

        const { content } = await super.doRequest(this.clientConfig, requestConfig);
        return this.#parseListBucketsResponseContent(content!);
    }

    /**
     * List buckets with query parameters
     * @param  {ListBucketsQuery}  query 
     * @return {Promise<Bucket[]>}       
     */
    async listBuckets(query?: ListBucketsQuery, options?: ListBucketsOptions): Promise<Bucket[]> {
        const result = await this.#listBuckets(query, options);
        return result.buckets;
    }

    /**
     * list all buckets
     * @param  {ListBucketsOptions} options 
     * @return {Promise<Bucket[]>}          
     */
    async listAllBuckets(options?: ListBucketsOptions): Promise<Bucket[]> {
        const allBuckets: Bucket[] = [];
        let marker: string | null = null;

        while (true) {
            const q: ListBucketsQuery = {};

            if (marker) {
                q.marker = marker;
            }

            const result = await this.#listBuckets(q, options);
            result.buckets.forEach(b => allBuckets.push(b));

            if (result.isTruncated && result.nextMarker) {
                marker = result.nextMarker;
            } else {
                break;
            }
        }

        return allBuckets;
    }

    #parseListBucketsResponseContent(responseContent: string): ListBucketsResult {
        const doc = parseXml(responseContent);

        //@ts-ignore xml parser
        const resultDoc = doc.ListAllMyBucketsResult;

        const { 
            //@ts-ignore xml parser
            Prefix: prefix, 

            //@ts-ignore xml parser
            Marker: marker, 

            //@ts-ignore xml parser
            MaxKeys: maxKeys,  

            //@ts-ignore xml parser
            IsTruncated: isTruncated,

            //@ts-ignore xml parser
            NextMarker: nextMarker
        } = resultDoc;

        const result: ListBucketsResult = {
            buckets: []
        };

        if (prefix) {
            result.prefix = prefix;
        }

        if (marker) {
            result.marker = marker;
        }

        if (maxKeys) {
            result.maxKeys = parseInt(maxKeys);
        }

        if (isTruncated !== undefined) {
            result.isTruncated = isTruncated;
        }

        if (nextMarker) {
            result.nextMarker = nextMarker;
        }

        // 如果返回只有一个 Bucket，xml parser 会解析成一个对象而不是一个数组
        // 所以要进行特殊的处理
        //@ts-ignore xml parser
        const bucketsDoc = Array.isArray(resultDoc.Buckets.Bucket) ? resultDoc.Buckets.Bucket : [resultDoc.Buckets.Bucket];
        if (bucketsDoc) {
            //@ts-ignore xml parser
            bucketsDoc.forEach(b => {
                const {
                    Comment: comment,
                    CreationDate: creationDate,
                    ExtranetEndpoint: extranetEndpoint,
                    IntranetEndpoint: intranetEndpoint,
                    Location: location,
                    Name: name,
                    Region: region,
                    StorageClass: storageClass,
                    ResourceGroupId: resourceGroupId,
                } = b;

                const bucket: Bucket = {
                    name, 
                    comment,
                    creationDate: new Date(creationDate),
                    extranetEndpoint,
                    intranetEndpoint,
                    location,
                    region,
                    storageClass,
                    resourceGroupId,
                };

                result.buckets.push(bucket);
            });
        }

        return result;
    }

    /**
     * Get bucket detail informaiton
     * @param {string} bucketName [description]
     */
    async getBucketInfo(bucketName: string): Promise<BucketInfo> {
        const query: Record<string, string | null> = {
            bucketInfo: null
        };
        
        const requestConfig: RequestConfig = {
            method: "GET",
            bucketName: bucketName,
            query: query,
        };

        const responseContent = await super.doRequest(this.clientConfig, requestConfig);
        //@ts-ignore xml parser
        const bucketNode = parseXml(responseContent).BucketInfo.Bucket;

        //@ts-ignore xml parser
        const {
            Comment: comment,
            CreationDate: creationDate,
            ExtranetEndpoint: extranetEndpoint,
            IntranetEndpoint: intranetEndpoint,
            Location: location,
            Name: name,
            Region: region,
            StorageClass: storageClass,
            ResourceGroupId: resourceGroupId,
            AccessMonitor: accessMonitor,
            BlockPublicAccess: blockPublicAccess,
            CrossRegionReplication: crossRegionReplication,
            DataRedundancyType: dataRedundancyType,
            KMSMasterKeyID: kmsMasterKeyId,
            TransferAcceleration: transferAcceleration,
            AccessControlList: accessControlList,
            ServerSideEncryptionRule: serverSideEncryptionRule,
            BucketPolicy: bucketPolicy,
            Versioning: versioning,
        } = bucketNode;

        const bucketInfo: BucketInfo = {
            name, 
            comment,
            creationDate: new Date(creationDate),
            extranetEndpoint,
            intranetEndpoint,
            location,
            region,
            storageClass,
            resourceGroupId,
            blockPublicAccess,
            accessMonitor,
            crossRegionReplication,
            dataRedundancyType,
            kmsMasterKeyId,
            accessControlList: {
                grant: accessControlList?.Grant
            },
            transferAcceleration,
            serverSideEncryptionRule: {
                sseAlgorithm: serverSideEncryptionRule?.SSEAlgorithm
            },
            bucketPolicy: {
                logBucket: bucketPolicy?.LogBucket,
                logPrefix: bucketPolicy?.LogPrefix
            },
            versioning,
        };

        return bucketInfo;
    }

    /**
     * List objects
     */
    async listObjects(bucketName: string, query?: ListObjectsQuery): Promise<ListObjectsResult> {
        const params: Record<string, string | number | boolean> = {
            "list-type": 2,
        };

        if (query) {
            Object.entries(query).forEach(([k, v]) => params[camelToKebab(k)] = v);
        }

        const requestConfig: RequestConfig = {
            method: "GET",
            bucketName,
            query: params
        };

        const { content } = await super.doRequest(this.clientConfig, requestConfig);
        const doc = parseXml(content!);
        //@ts-ignore xml parser
        const resultNode = doc.ListBucketResult;
        
        //@ts-ignore xml parser
        const { Name: name, Prefix: prefix, MaxKeys: maxKeys, Delimiter: delimiter, IsTruncated: isTruncated, NextContinuationToken: nextContinuationToken, KeyCount: keyCount } = resultNode;
        
        //@ts-ignore xml parser
        const commonPrefixes: string[] = [];

        //@ts-ignore xml parser
        if (resultNode.CommonPrefixes) {
            //@ts-ignore xml parser
            const commonPrefixeNodes = Array.isArray(resultNode.CommonPrefixes) ? resultNode.CommonPrefixes : [resultNode.CommonPrefixes];

            //@ts-ignore xml parser
            commonPrefixeNodes.forEach(n => commonPrefixes.push(n.Prefix));
        }
        
        const contents: ListObjectsContent[] = [];

        //@ts-ignore xml parser
        if (resultNode.Contents) {
            //@ts-ignore xml parser
            const contentsNodes = Array.isArray(resultNode.Contents) ? resultNode.Contents : [resultNode.Contents];
            //@ts-ignore xml parser
            contentsNodes.forEach(n => {
                //@ts-ignore xml parser
                contents.push({
                    key: n.Key,
                    lastModified: new Date(n.LastModified),
                    eTag: n.ETag,
                    type: n.Type,
                    size: n.Size,
                    storageClass: n.StorageClass,
                    restoreInfo: n.RestoreInfo
                });
            });
        }

        return {
            name,
            prefix, 
            maxKeys,
            delimiter,
            isTruncated,
            nextContinuationToken,
            keyCount,
            commonPrefixes,
            contents
        };
    }
}

