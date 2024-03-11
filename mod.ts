export type { 
    Bucket, 
    ListBucketsOptions, 
    BucketInfo, 
    ListObjectsQuery, 
    ListObjectsResult 
} from "./bucket.ts";

export type { 
    PutObjectOptions, 
    PutObjectResult, 
    HeadObjectOptions, 
    GetObjectOptions, 
    DeleteObjectOptions, 
    SignatureOptions, 
    GetObjectMetaOptions, 
    GetObjectMetaResult,
    MultipartUploadOptions
} from "./object.ts";

export * from "./oss_client.ts";
