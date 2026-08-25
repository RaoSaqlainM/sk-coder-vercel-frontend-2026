export type ApkManifestMetadataField = "packageName" | "appLabel" | "appIcon" | "installLocation" | "versionCode" | "versionName" | "minSdkVersion" | "targetSdkVersion";

export type ApkManifestMetadata = Record<ApkManifestMetadataField, string>;

function readAttribute(tag: string, name: string) {
    return tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, "i"))?.[1] || "";
}

function escapeAttribute(value: string) {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function replaceAttribute(tag: string, name: string, value: string) {
    const expression = new RegExp(`\\s${name}=["'][^"']*["']`, "i");
    const next = `${name}="${escapeAttribute(value)}"`;
    return expression.test(tag) ? tag.replace(expression, ` ${next}`) : tag.replace(/>$/, ` ${next}>`);
}

function updateTag(xml: string, expression: RegExp, name: string, value: string) {
    return xml.replace(expression, (tag) => replaceAttribute(tag, name, value));
}

export function readApkManifestMetadata(xml: string): ApkManifestMetadata {
    const manifest = xml.match(/<manifest\b[^>]*>/i)?.[0] || "";
    const application = xml.match(/<application\b[^>]*>/i)?.[0] || "";
    const usesSdk = xml.match(/<uses-sdk\b[^>]*>/i)?.[0] || "";
    const installLocation = readAttribute(manifest, "android:installLocation");
    return {
        packageName: readAttribute(manifest, "package"),
        appLabel: readAttribute(application, "android:label"),
        appIcon: readAttribute(application, "android:icon"),
        installLocation: ["auto", "internalOnly", "preferExternal"].includes(installLocation) ? installLocation : "auto",
        versionCode: readAttribute(manifest, "android:versionCode"),
        versionName: readAttribute(manifest, "android:versionName"),
        minSdkVersion: readAttribute(usesSdk, "android:minSdkVersion"),
        targetSdkVersion: readAttribute(usesSdk, "android:targetSdkVersion"),
    };
}

export function updateApkManifestMetadata(xml: string, field: ApkManifestMetadataField, value: string) {
    if (["packageName", "versionCode", "versionName", "installLocation"].includes(field)) {
        const attribute = field === "packageName" ? "package" : field === "versionCode" ? "android:versionCode" : field === "versionName" ? "android:versionName" : "android:installLocation";
        return updateTag(xml, /<manifest\b[^>]*>/i, attribute, value);
    }
    if (field === "appLabel" || field === "appIcon") {
        return updateTag(xml, /<application\b[^>]*>/i, field === "appLabel" ? "android:label" : "android:icon", value);
    }
    const attribute = field === "minSdkVersion" ? "android:minSdkVersion" : "android:targetSdkVersion";
    if (/<uses-sdk\b[^>]*>/i.test(xml)) {
        return updateTag(xml, /<uses-sdk\b[^>]*>/i, attribute, value);
    }
    return xml.replace(/<manifest\b[^>]*>/i, (tag) => `${tag}\n    <uses-sdk ${attribute}="${escapeAttribute(value)}"/>`);
}
