import { parse as parseXml } from "xml/mod.ts";

/**
 * Common options for aliyun oss operations
 */
export interface CommonOptions {
    /**
     * Operation timeout in milliseconds
     * @type {[type]}
     */
    timeoutMs?: number;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "HEAD" | "OPTIONS";

/** 
 * Aliyun OSS client configurations
 */
export interface ClientConfig {
    /**
     * The region. e.g. `cn-hangzhou`, `cn-beijing`. region is region id without `oss-` prefix.
     */
    region: string;

    /**
     * The endpoint to connect to. e.g. `oss-cn-zhangjiakou.aliyuncs.com` for internet, `oss-cn-zhangjiakou-internal.aliyuncs.com` for VPC.
     */
    endpoint: string;

    accessKeyId: string;
    accessKeySecret: string;

    /**
     * Send request over HTTPS protocol or not. Default value is `true`.
     */
    secure?: boolean;

    /**
     * Use cname instead of aliyun regular endpoint. Default value is `false`.
     */
    cname?: boolean;

    /**
     * Operation timeout settings in milliseconds. If this property is left `undefined` or set to invalid number, request will no be timeout.
     */
    timeoutMs?: number;
};

/**
 * OSS client error
 */
export class ClientError extends Error {
    #code?: string;
    #requestId?: string;
    #hostId?: string;
    #ec?: string;
    #recommendDoc?: string;
    #bucketName?: string;
    /**
     * http status code
     */
    #status?: number;

    constructor(message?: string, code?: string, bucketName?: string, requestId?: string, hostId?: string, ec?: string, recommendDoc?: string, status?: number) {
        super(message);
        this.#code = code;
        this.#bucketName = bucketName;
        this.#requestId = requestId;
        this.#hostId = hostId;
        this.#recommendDoc = recommendDoc;
        this.#ec = ec;
        this.#status = status;
    }

    static fromResponseContent(responseContent: string): ClientError {
        const doc = parseXml(responseContent);
        //@ts-ignore xml parser
        const errorNode = doc.Error;
        if (! errorNode) {
            return new ClientError("unknown error");
        }

        //@ts-ignore xml parser
        const { Code: code, Message: message, RequestId: requestId, HostId: hostId, BucketName: bucketName, EC: ec, RecommendDoc: recommendDoc } = errorNode;

        return new ClientError(
            message,
            code,
            bucketName,
            requestId,
            hostId,
            ec,
            recommendDoc
        );
    }

    toJSON() {
        return {
            message: this.message,
            bucketName: this.#bucketName,
            code: this.#code,
            requestId: this.#requestId,
            hostId: this.#hostId,
            ec: this.#ec,
            recommendDoc: this.#recommendDoc,
            status: this.#status
        };
    }

    get code() {
        return this.#code;
    }

    get bucketName() {
        return this.#bucketName;
    }

    get requestId() {
        return this.#requestId;
    }

    get hostId() {
        return this.#hostId;
    }

    get ec() {
        return this.#ec;
    }

    get recommendDoc() {
        return this.#recommendDoc;
    }

    get status() {
        return this.#status;
    }

    set status(val: number | undefined) {
        this.#status = val;
    }
}


/**
 * Request configurations.
 * @internal
 */
export interface RequestConfig {
    method: HttpMethod,
    bucketName?: string;
    objectKey?: string;
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: ReadableStream;
    //deno-lint-ignore no-explicit-any
    options?: Record<string, any>
};

export interface ResponseResult {

    /**
     * 响应头
     */
    headers: Record<string, string>;

    /**
     * 响应内容
     */
    content?: string;
}

/**
 * OSS owner info
 */
export interface Owner {
    id: string;
    displayName: string;
}
