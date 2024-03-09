import { parse as parseXml } from "xml/mod.ts";

import { ClientConfig, CommonOptions, RequestConfig } from "./common.ts";
import { Operation } from "./operation.ts";
import { camelToKebab, isBlank } from "./helper.ts";

/**
 * List buckets query parameters.
 * See [Official Documents](https://help.aliyun.com/zh/oss/developer-reference/listbuckets) for more details.
 */
export interface ListBucketsOptions {
    /**
     * 限定返回的 Bucket 名称必须以 `prefix` 作为前缀。如果不设定，则不过滤前缀信息。
     */
    prefix?: string;

    /**
     * 设定结果从 `marker` 之后按字母排序的第一个开始返回。如果不设定，则从头开始返回数据。
     */
    marker?: string;

    /**
     * 限定此次返回 Bucket 的最大个数。取值范围：`1~1000`。默认值：`100`
     */
    maxKeys?: number;

    /**
     * 返回属于该资源组的所有 Bucket
     */
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
export interface ListObjectsQuery extends CommonOptions {
    /**
     * 对 Object 名字进行分组的字符。所有 Object 名字包含指定的前缀，第一次出现 `delimiter` 字符之间的 Object 作为一组元素（即 CommonPrefixes）。
     */
    delimiter?: string;

    /**
     * 设定从 `start-after` 之后按字母排序开始返回 Object。
     * `start-after 用来实现分页显示效果，参数的长度必须小于 `1024 字节。
     * 做条件查询时，即使 `start-after` 在列表中不存在，也会从符合 `start-after` 字母排序的下一个开始打印。
     */
    startAfter?: string;

    /**
     * 指定从此 Token 开始列出 Object。可以从上一次查询结果中的 `nextContinuationToken` 获取 Token。
     */
    continuationToken?: string;

    /**
     * `0 - 1000` 的数字，表示本次查询返回的 Object 的最大数量。
     */
    maxKeys?: number;

    /**
     * 限定返回文件的 Key 必须以 `prefix` 作为前缀。
     * 如果把 `prefix` 设为某个文件夹名，则列举以此 `prefix` 开头的文件，即该文件夹下递归的所有文件和子文件夹。
     * 在设置 `prefix` 的基础上，将 `delimiter` 设置为正斜线（`/`）时，
     * 返回值就只列举该文件夹下的文件，文件夹下的子文件夹名返回在 `commonPrefixes` 中，
     * 子文件夹下递归的所有文件和文件夹不显示。
     * 
     * 例如，一个 Bucket 中有三个 Object，分别为 `fun/test.jpg`、`fun/movie/001.avi` 和 `fun/movie/007.avi`。
     * 
     * 如果设定 `prefix` 为 `fun/`，则返回三个 Object；
     * 
     * 如果在 `prefix` 设置为 `fun/` 的基础上，将 `delimiter` 设置为正斜线（`/`），
     * 则返回 `fun/test.jpg` 和 `fun/movie/`。
     * @type {[type]}
     */
    prefix?: string;
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
    async #listBuckets(options?: ListBucketsOptions): Promise<ListBucketsResult> {
        const { prefix, marker, maxKeys, resourceGroupId } = Object.assign({}, options);

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

        const requestConfig: RequestConfig = {
            method: "GET",
            query: requestQuery,
            headers: requestHeaders,
        };

        const { content } = await super.doRequest(requestConfig);
        return this.#parseListBucketsResponseContent(content!);
    }

    /**
     * List buckets with query parameters
     * @return {Promise<Bucket[]>}       
     */
    async listBuckets(options?: ListBucketsOptions): Promise<Bucket[]> {
        const result = await this.#listBuckets(options);
        return result.buckets;
    }

    /**
     * list all buckets
     * @return {Promise<Bucket[]>}          
     */
    async listAllBuckets(): Promise<Bucket[]> {
        const allBuckets: Bucket[] = [];
        let marker: string | null = null;

        while (true) {
            const q: ListBucketsOptions = {};

            if (marker) {
                q.marker = marker;
            }

            const result = await this.#listBuckets(q);
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

        const responseContent = await super.doRequest(requestConfig);
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

        const { content } = await super.doRequest(requestConfig);
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

