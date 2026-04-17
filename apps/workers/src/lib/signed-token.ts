import { Buffer } from "node:buffer";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const importedTokenKeyCache = new Map<string, Promise<CryptoKey>>();

type SignedTokenPayload = {
	v: number;
	subdomain: string;
	exp: number;
	nonce: string;
};

type SignedTokenOptions = {
	ttlMs: number;
	version: number;
};

export async function createSignedToken(
	secret: string,
	subdomain: string,
	options: SignedTokenOptions,
): Promise<string> {
	const payload: SignedTokenPayload = {
		v: options.version,
		subdomain,
		exp: Date.now() + options.ttlMs,
		nonce: crypto.randomUUID(),
	};
	const encodedPayload = encodeBase64Url(JSON.stringify(payload));
	const signature = await signPayload(secret, encodedPayload);

	return `${encodedPayload}.${signature}`;
}

export async function verifySignedToken(
	secret: string,
	subdomain: string,
	token: string,
	options: SignedTokenOptions,
): Promise<boolean> {
	const [encodedPayload, encodedSignature, ...rest] = token.split(".");

	if (!encodedPayload || !encodedSignature || rest.length > 0) {
		return false;
	}

	const payload = parsePayload(encodedPayload);

	if (!payload) {
		return false;
	}

	if (
		payload.v !== options.version ||
		payload.subdomain !== subdomain ||
		payload.exp < Date.now()
	) {
		return false;
	}

	const key = await importTokenKey(secret);

	return crypto.subtle.verify(
		"HMAC",
		key,
		decodeBase64Url(encodedSignature),
		encoder.encode(encodedPayload),
	);
}

function parsePayload(encodedPayload: string): SignedTokenPayload | null {
	try {
		const parsed = JSON.parse(
			decoder.decode(decodeBase64Url(encodedPayload)),
		) as unknown;

		if (!isSignedTokenPayload(parsed)) {
			return null;
		}

		return parsed;
	} catch {
		return null;
	}
}

function isSignedTokenPayload(value: unknown): value is SignedTokenPayload {
	if (!isJsonRecord(value)) {
		return false;
	}

	return (
		typeof value.v === "number" &&
		typeof value.subdomain === "string" &&
		typeof value.exp === "number" &&
		typeof value.nonce === "string"
	);
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

async function signPayload(
	secret: string,
	encodedPayload: string,
): Promise<string> {
	const key = await importTokenKey(secret);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(encodedPayload),
	);

	return encodeBase64Url(new Uint8Array(signature));
}

function importTokenKey(secret: string): Promise<CryptoKey> {
	const cachedKey = importedTokenKeyCache.get(secret);

	if (cachedKey) {
		return cachedKey;
	}

	const keyPromise = crypto.subtle
		.importKey(
			"raw",
			encoder.encode(secret),
			{ name: "HMAC", hash: "SHA-256" },
			false,
			["sign", "verify"],
		)
		.catch((error) => {
			importedTokenKeyCache.delete(secret);
			throw error;
		});

	importedTokenKeyCache.set(secret, keyPromise);
	return keyPromise;
}

function encodeBase64Url(value: Uint8Array | string): string {
	return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value: string): Uint8Array {
	return Buffer.from(value, "base64url");
}
