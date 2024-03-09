import { load } from "std/dotenv/mod.ts";
import { Closer } from "std/io/types.ts";

const DEBUG = await (async () => {
    if (!Deno.env.get("DEBUG")) {
        const dotenv = await load();
        return dotenv["DEBUG"] && dotenv["DEBUG"].includes("oss-sdk");
    } else {
        return Deno.env.get("DEBUG")!.includes("oss-sdk");
    }
})();


/**
 * Get date string in oss date format
 * @param  {Date}   d [description]
 * @return {string}   e.g. 20231203T121212Z
 */
export function ossDateString(d?: Date): string {
    const dd = d ? d : new Date();
    let s = dd.toISOString();
    s = `${s.substring(0, s.length - 5)}Z`;
    return s.replaceAll(/[\-:]/g, "");
};


export function log(msg: string) {
    if (!DEBUG) {
        return;
    }
    console.log(msg);
}

/**
 * Merge multiple `Uint8Array`s into one
 * @param  {Uint8Array[]} ...arrays The arrays to merge
 * @return {Uint8Array}             Merged `Uint8Array`
 */
export function mergeUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
    const totalSize = arrays.reduce((acc, e) => acc + e.length, 0);
    const merged = new Uint8Array(totalSize);

    arrays.forEach((array, i, arrays) => {
        const offset = arrays.slice(0, i).reduce((acc, e) => acc + e.length, 0);
        merged.set(array, offset);
    });

    return merged;
}


/**
 * Convert property name from camel case to kebab case
 * @param k The camel case
 * @returns snake case property name. e.g. `startAfter` will be converted to `start-after`
 */
export function camelToKebab(k: string): string {
    return k.replace(/[A-Z]/g, (p1) => {
        return `-${p1.toLowerCase()}`;
    });
}


export function isBlank(s: string | undefined | null): boolean {
    if (s === null || s === undefined) {
        return true;
    }

    return s.trim().length === 0;
}

/**
 * 对字符串中特殊的字符进行编码，以保证放到 XML 中是一个合法的数据。
 *
 * 参考：https://www.liquid-technologies.com/Reference/Glossary/XML_EscapingData.html
 */
export function escapeXmlSpecialChars(s: string): string {
    return s.replace(/[<>"'&]/g, (p1) => {
        if (p1 === "<") {
            return "&lt;"
        }

        if (p1 === ">") {
            return "&gt;";
        }

        if (p1 === "\"") {
            return "&quot;";
        }

        if (p1 === "'") {
            return "&apos;"
        }

        if (p1 === "&") {
            return "&amp;"
        }
        return p1;
    });
}

/**
 * Some resource in Deno will be closed automatically after use.
 * So when we are going to close a "closed" resource, error will be thrown
 * Here is a helper function to close resource an silent the error
 */
export function closeResource(res: Closer | undefined) {
    if (! res) {
        return;
    }
    
    try {
        res.close();
    } catch (_e) {
        // silent the error
    }
}