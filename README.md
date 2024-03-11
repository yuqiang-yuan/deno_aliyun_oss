# Aliyun OSS SDK for Deno

Aliyun OSS SDK implemented with TypeScript for Deno runtime.

用在 Deno 中的阿里云 OSS SDK。

目前仅实现了一些简单的功能：

- Bucket 操作
  - `listBuckets`：列出 Bucket，支持查询参数
  - `listAllBuckets`：列出全部 Bucket
  - `getBucketInfo`：获取 Bucket 信息

- Object 操作
  - `listObjects`：列出文件
  - `createFolder`：创建“文件夹”
  - `putObject`：上传文件
  - `multipartUpload`：分片上传文件
  - `headObject`：获取文件响应头
  - `getObjectMeta`：获取文件元数据
  - `getObject`：下载文件
  - `deleteObject`：删除文件
  - `deleteMultipleObjects`：一次删除多个文件
  - `singatureUrl`：生成预签名 URL。目前只测试了 `GET` 请求，未测试其他请求。


使用方法：

```typescript
import { OssClient } from "https://deno.land/x/deno_aliyun_oss@v0.1.0/mod.ts";

const client = new OssClient("region", "endpoint", "accessKeyId", "accessKeySecret");

await client.listAllBuckets();
```

