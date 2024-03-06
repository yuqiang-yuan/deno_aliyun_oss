import { crypto } from "std/crypto/mod.ts";
import { encodeHex } from "std/encoding/hex.ts";


import { hmac } from "hmac/mod.ts";

import { ClientConfig, RequestConfig, ClientError, ResponseResult } from "./common.ts";
import { ossDateString, log } from "./helper.ts";


/**
 * OSS operation
 */
export class Operation {
    #clientConfig;

    constructor(config: ClientConfig) {
        this.#clientConfig = config;
    }

    get clientConfig() {
        return this.#clientConfig;
    }

    /**
     * Build canonical uri for signature
     * @param  {string} bucketName 
     * @param  {string} objectKey  
     * @return {string}            
     */
    #buildCanonicalUri(bucketName?: string, objectKey?: string): string {
        // 如果请求的 URI 中既包含 Bucket 也包含 Object，则 Canonical URI填写示例为 /examplebucket/exampleobject
        if (bucketName && objectKey) {
            const encodedObjectKey = objectKey.split("/").map(s => encodeURIComponent(s)).join("/");
            return `/${encodeURIComponent(bucketName)}/${encodedObjectKey}`;
        }

        // 如果请求的 URI 中只包含 Bucket 不包含 Object，则 Canonical URI 填写示例为 /examplebucket/
        if (bucketName && !objectKey) {
            return `/${encodeURIComponent(bucketName)}/`;
        }

        // 如果请求的 URI 中不包含 Bucket 只包含 Object ，则 Canonical URI 填写示例为 /
        if (!bucketName && objectKey) {
            return "/";
        }

        return "/";
    }

    /**
     * Build the uri to send request
     * @param  {string} objectKey  
     * @return {string}
     */
    #buildRequestUri(objectKey?: string): string {
        if (objectKey) {
            const encodedObjectKey = objectKey.split("/").map(s => encodeURIComponent(s)).join("/");
            return `/${encodedObjectKey}`;
        }

        return "/";
    }

    #buildCanonicalQueryString(query?: Record<string, string | number | boolean | null | undefined>): string {
        if (!query) {
            return "";
        }

        const joinedString = Object.entries(query)
            .sort((e1, e2) => e1[0].localeCompare(e2[0]))
            .map(([k, v]) => {
                const s = v === null || v === undefined || `${v}`.trim().length === 0
                          ? ""
                          : `=${encodeURIComponent(v)}`;
                return `${k}${s}`; 
            })
            .join("&");

        return `${joinedString}`;
    }

    #buildCanonicalHeaders(headers?: Record<string, string>): string {
        if (!headers) {
            return "\n";
        }

        const joinedString = Object.entries(headers)
            .map(([k, v]) => [k.toLowerCase(), v.trim()])
            .sort((e1, e2) => e1[0].localeCompare(e2[0]))
            .map(([k, v]) => `${k}:${v}`)
            .join("\n");

        return `${joinedString}\n`;
    }

    protected async doRequest(requestConfig: RequestConfig): Promise<ResponseResult> {
        const SIG_VERSION = "OSS4-HMAC-SHA256";

        const { region, endpoint, accessKeyId, accessKeySecret, secure, cname, timeoutMs } = this.#clientConfig;
        const { method, bucketName, objectKey, headers, query, body, options } = requestConfig;

        const domainName = `${bucketName ? bucketName : ""}${bucketName ? "." : ""}${endpoint}`;

        const d = new Date();
        const dateTimeString = ossDateString(d);
        const dateString = dateTimeString.substring(0, 8);
        const allHeaders: Record<string, string> = Object.assign({
            "date": d.toUTCString(),
            "host": domainName,
            "x-sdk-client": "deno/0.1.0",
            "x-oss-content-sha256": "UNSIGNED-PAYLOAD",
            "x-oss-date": dateTimeString,
        }, headers);
        
        
        if (method === 'PUT') {
            if (!body) {
                allHeaders["content-length"] = "0";
            }
        }

        const headersToSign: Record<string, string> = {};

        Object.entries(allHeaders).filter(([k, _v]) => {
            const s = k.toLowerCase();
            return s === "content-type" || s === "content-md5" || s === "host" || s.startsWith("x-oss-");
        }).forEach(([k, v]) => headersToSign[k] = v);

        const canonicalUri = this.#buildCanonicalUri(bucketName, objectKey);
        const requestUri = this.#buildRequestUri(objectKey);
        const canonicalQuery = this.#buildCanonicalQueryString(query);
        const canonicalHeaders = this.#buildCanonicalHeaders(headersToSign);
        const additionalHeaders = Object.keys(headersToSign).map(k => k.toLowerCase()).sort((k1, k2) => k1.localeCompare(k2)).join(";");

        const hashedPayload = "UNSIGNED-PAYLOAD"; //

        const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuery}\n${canonicalHeaders}\n${additionalHeaders}\n${hashedPayload}`;

        const canonicalRequestData = (new TextEncoder()).encode(canonicalRequest);
        const hashedRequest = encodeHex(await crypto.subtle.digest("SHA-256", canonicalRequestData));

        log("\n---- begin of canonical request ----");
        log(canonicalRequest);
        log("---- end of canonical request ----\n");

        const scope = `${dateString}/${region}/oss/aliyun_v4_request`;

        const strToSign = `${SIG_VERSION}\n${dateTimeString}\n${scope}\n${hashedRequest}`;

        log("\n---- begin of string to sign----");
        log(strToSign);
        log("---- end of string to sign ----\n")

        let keyData = (new TextEncoder()).encode(`aliyun_v4${accessKeySecret}`);
        let msgData = (new TextEncoder()).encode(dateString);
        keyData = hmac("sha256", keyData, msgData) as Uint8Array;

        msgData = (new TextEncoder()).encode(region);
        keyData = hmac("sha256", keyData, msgData) as Uint8Array;

        msgData = (new TextEncoder()).encode("oss");
        keyData = hmac("sha256", keyData, msgData) as Uint8Array;

        msgData = (new TextEncoder()).encode("aliyun_v4_request");
        keyData = hmac("sha256", keyData, msgData) as Uint8Array;

        msgData = (new TextEncoder()).encode(strToSign);
        const signature = encodeHex(hmac("sha256", keyData, msgData));

        const authorization = `${SIG_VERSION} Credential=${accessKeyId}/${scope},AdditionalHeaders=${additionalHeaders},Signature=${signature}`;
        allHeaders["Authorization"] = authorization;
        
        let fullUrl = `${secure ? "https://" : "http://"}${domainName}${requestUri}`;
        if (canonicalQuery) {
            fullUrl = `${fullUrl}?${canonicalQuery}`;
        }
        
        log(`> ${method} ${fullUrl}\n`);
        Object.entries(allHeaders).forEach(([k, v]) => log(`> headers: ${k}: ${v}`));

        log("-----------------------------------------------------------------------");

        const requestInit:RequestInit = {
            method: method,
            headers: allHeaders,
            keepalive: false,
        };

        if (body) {
            requestInit.body = body;
        }

        try {
            const response = await fetch(fullUrl, requestInit);
            log(`< resopnse status code: ${response.status}`);
            const status = response.status;
            if (status >= 500) {
                throw new ClientError(`aliyun oss server response status: ${status}`);
            }

            const content = await response.text();
            log("\n---- begin of response content -----");
            log(content);
            log("---- end of response content ----\n");

            if (400 <= status && status < 500) {
                throw ClientError.fromResponseContent(content);
            }

            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((v, k) => {
                log(`< headers: ${k}: ${v}`);
                responseHeaders[k] = v;
            });
            return {
                headers: responseHeaders,
                content,
            };
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

}

