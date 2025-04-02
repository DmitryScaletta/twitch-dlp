#!/usr/bin/env node
import fsp from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { parseArgs } from "node:util";
import childProcess from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import stream from "node:stream";
import crypto from "node:crypto";

//#region node_modules/.pnpm/twitch-gql-queries@0.1.11/node_modules/twitch-gql-queries/dist/index.js
var CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
var MAX_QUERIES_PER_REQUEST = 35;
var gqlRequest = async (queries, requestInit) => {
	if (queries.length === 0) return [];
	if (queries.length > MAX_QUERIES_PER_REQUEST) throw new Error(`Too many queries. Max: ${MAX_QUERIES_PER_REQUEST}`);
	const res = await fetch("https://gql.twitch.tv/gql", {
		method: "POST",
		body: JSON.stringify(queries),
		headers: {
			"Client-Id": CLIENT_ID,
			...requestInit?.headers
		},
		...requestInit
	});
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	return res.json();
};
var getQueryFfzBroadcastId = (variables) => ({
	operationName: "FFZ_BroadcastID",
	variables,
	extensions: { persistedQuery: {
		version: 1,
		sha256Hash: "cc89dfe8fcfe71235313b05b34799eaa519d162ebf85faf0c51d17c274614f0f"
	} }
});
var getQueryPlaybackAccessToken = (variables) => ({
	operationName: "PlaybackAccessToken",
	variables,
	extensions: { persistedQuery: {
		version: 1,
		sha256Hash: "ed230aa1e33e07eebb8928504583da78a5173989fadfb1ac94be06a04f3cdbe9"
	} }
});
var getQueryStreamMetadata = (variables) => ({
	operationName: "StreamMetadata",
	variables,
	extensions: { persistedQuery: {
		version: 1,
		sha256Hash: "252a46e3f5b1ddc431b396e688331d8d020daec27079893ac7d4e6db759a7402"
	} }
});
var getQueryVideoMetadata = (variables) => ({
	operationName: "VideoMetadata",
	variables,
	extensions: { persistedQuery: {
		version: 1,
		sha256Hash: "45111672eea2e507f8ba44d101a61862f9c56b11dee09a15634cb75cb9b9084d"
	} }
});

//#endregion
//#region src/utils/fetchText.ts
const fetchText = async (url, description = "metadata") => {
	console.log(`Downloading ${description}`);
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error();
		return res.text();
	} catch (e) {
		console.error(`Unable to download ${description}`);
		return null;
	}
};

//#endregion
//#region src/api/twitch.ts
const apiRequest = async (query, resultKey, description = "metadata") => {
	console.log(`Downloading ${description}`);
	try {
		const [res] = await gqlRequest([query]);
		return res?.data[resultKey] || null;
	} catch (e) {
		console.error(`Unable to download ${description}`);
		return null;
	}
};
const getVideoAccessToken = (id) => apiRequest(getQueryPlaybackAccessToken({
	isLive: false,
	login: "",
	isVod: true,
	vodID: id,
	playerType: "site",
	platform: "web"
}), "videoPlaybackAccessToken", "video access token");
const getStreamMetadata = (channelLogin) => apiRequest(getQueryStreamMetadata({ channelLogin }), "user", "stream metadata");
const getVideoMetadata = (videoId) => apiRequest(getQueryVideoMetadata({
	channelLogin: "",
	videoID: videoId
}), "video", "video metadata");
const getBroadcast = (channelId) => apiRequest(getQueryFfzBroadcastId({ id: channelId }), "user", "broadcast id");
const getManifest = (videoId, accessToken) => {
	const params = new URLSearchParams({
		allow_source: "true",
		allow_audio_only: "true",
		allow_spectre: "true",
		player: "twitchweb",
		playlist_include_framerate: "true",
		sig: accessToken.signature,
		token: accessToken.value
	});
	const url = `https://usher.ttvnw.net/vod/${videoId}.m3u8?${params}`;
	return fetchText(url, "video manifest");
};

//#endregion
//#region src/constants.ts
const PRIVATE_VIDEO_INSTRUCTIONS = "This video might be private. Follow this article to download it: https://github.com/DmitryScaletta/twitch-dlp/blob/master/DOWNLOAD_PRIVATE_VIDEOS.md";
const VOD_DOMAINS = [
	"https://d2e2de1etea730.cloudfront.net",
	"https://dqrpb9wgowsf5.cloudfront.net",
	"https://ds0h3roq6wcgc.cloudfront.net",
	"https://d2nvs31859zcd8.cloudfront.net",
	"https://d2aba1wr3818hz.cloudfront.net",
	"https://d3c27h4odz752x.cloudfront.net",
	"https://dgeft87wbj63p.cloudfront.net",
	"https://d1m7jfoe9zdc1j.cloudfront.net",
	"https://d3vd9lfkzbru3h.cloudfront.net",
	"https://d2vjef5jvl6bfs.cloudfront.net",
	"https://d1ymi26ma8va5x.cloudfront.net",
	"https://d1mhjrowxxagfy.cloudfront.net",
	"https://ddacn6pr5v0tl.cloudfront.net",
	"https://d3aqoihi2n8ty8.cloudfront.net"
];
const DOWNLOADERS = [
	"aria2c",
	"curl",
	"fetch"
];
const MERGE_METHODS = ["ffconcat", "append"];
const UNMUTE_POLICIES = [
	"quality",
	"any",
	"same_format",
	"none"
];
const COLOR = {
	reset: "\x1B[0m",
	green: "\x1B[32m",
	yellow: "\x1B[33m",
	cyan: "\x1B[36m",
	red: "\x1B[31m"
};
const RET_CODE = {
	OK: 0,
	UNKNOWN_ERROR: 1,
	HTTP_RETURNED_ERROR: 22
};
const LIVE_VIDEO_STATUS = {
	ONLINE: 0,
	OFFLINE: 1,
	FINALIZED: 2
};

//#endregion
//#region src/merge/append.ts
const mergeFrags$2 = async (frags, outputPath, keepFragments) => {
	throw new Error("Not implemented yet");
};

//#endregion
//#region src/utils/getPath.ts
const getPath = {
	output: (template, videoInfo) => {
		let finalTemplate = template;
		for (const [name, value] of Object.entries(videoInfo)) {
			let newValue = value ? String(value) : "";
			if (name.endsWith("_date")) newValue = newValue.slice(0, 10);
			newValue = newValue.replace(/[/\\?%*:|"'<>]/g, "");
			finalTemplate = finalTemplate.replaceAll(`%(${name})s`, newValue);
		}
		return path.resolve(finalTemplate);
	},
	ffconcat: (filePath) => `${filePath}-ffconcat.txt`,
	playlist: (filePath) => `${filePath}-playlist.m3u8`,
	frag: (filePath, i) => `${filePath}.part-Frag${i}`,
	fragUnmuted: (fragPath) => `${fragPath}-unmuted`
};

//#endregion
//#region src/merge/ffconcat.ts
const spawnFfmpeg = (args) => new Promise((resolve, reject) => {
	let isInputSection = true;
	let prevLine = "";
	const handleFfmpegData = (stream$1) => (data) => {
		if (!isInputSection) return stream$1.write(data);
		const str = data.toString();
		const lines = str.split("\n");
		lines[0] = prevLine + lines[0];
		prevLine = lines.pop() || "";
		for (const line of lines) {
			if (line.startsWith("  Stream #")) continue;
			if (line.startsWith("Stream mapping:")) isInputSection = false;
			stream$1.write(line + "\n");
		}
		if (!isInputSection) stream$1.write(prevLine);
	};
	const child = childProcess.spawn("ffmpeg", args);
	child.stdout.on("data", handleFfmpegData(process.stdout));
	child.stderr.on("data", handleFfmpegData(process.stderr));
	child.on("error", (err) => reject(err));
	child.on("close", (code) => resolve(code));
});
const runFfconcat = (ffconcatFilename, outputFilename) => spawnFfmpeg([
	"-hide_banner",
	"-avoid_negative_ts",
	"make_zero",
	"-analyzeduration",
	"2147483647",
	"-probesize",
	"2147483647",
	"-max_streams",
	"2147483647",
	"-n",
	"-f",
	"concat",
	"-safe",
	"0",
	"-i",
	ffconcatFilename,
	"-c",
	"copy",
	outputFilename
]);
const generateFfconcat = (files) => {
	let ffconcat = "ffconcat version 1.0\n";
	ffconcat += files.map(([file, duration]) => [
		`file '${file}'`,
		"stream",
		"exact_stream_id 0x100",
		"stream",
		"exact_stream_id 0x101",
		"stream",
		"exact_stream_id 0x102",
		`duration ${duration}`
	].join("\n")).join("\n");
	return ffconcat;
};
const mergeFrags$1 = async (frags, outputPath, keepFragments) => {
	const fragFiles = frags.map((frag) => [getPath.frag(outputPath, frag.idx + 1), frag.duration]);
	const ffconcat = generateFfconcat(fragFiles);
	const ffconcatPath = getPath.ffconcat(outputPath);
	await fsp.writeFile(ffconcatPath, ffconcat);
	const retCode = await runFfconcat(ffconcatPath, outputPath);
	fsp.unlink(ffconcatPath);
	if (keepFragments || retCode) return;
	await Promise.all([...fragFiles.map(([filename]) => fsp.unlink(filename)), fsp.unlink(getPath.playlist(outputPath))]);
};

//#endregion
//#region src/merge/index.ts
const [FFCONCAT, APPEND] = MERGE_METHODS;
const mergeFrags = async (method, frags, outputPath, keepFragments) => {
	if (method === FFCONCAT) return mergeFrags$1(frags, outputPath, keepFragments);
	if (method === APPEND) return mergeFrags$2(frags, outputPath, keepFragments);
	throw new Error(`Unknown merge method: ${method}. Available methods: ${MERGE_METHODS}`);
};

//#endregion
//#region src/downloaders/aria2c.ts
const isUrlsAvailableAria2c = (urls, urlsPath, gzip) => new Promise((resolve) => {
	const args = [
		"--dry-run",
		"--console-log-level",
		"error",
		"-i",
		urlsPath
	];
	if (gzip) args.push("--http-accept-gzip");
	const child = childProcess.spawn("aria2c", args);
	let data = "";
	child.stdout.on("data", (chunk) => data += chunk);
	child.on("error", () => resolve([]));
	child.on("close", () => {
		const matches = data.matchAll(/Exception:.*URI=(?<uri>\S+)/g);
		const notAvailableUrls = [];
		for (const m of matches) notAvailableUrls.push(m.groups.uri);
		resolve(urls.map((url) => !notAvailableUrls.includes(url)));
	});
});
const isUrlsAvailable$3 = async (urls) => {
	const urlsPath = path.resolve(os.tmpdir(), `aria2c-urls-${Date.now()}.txt`);
	await fsp.writeFile(urlsPath, urls.join("\n"));
	const [urlsNoGzip, urlsGzip] = await Promise.all([isUrlsAvailableAria2c(urls, urlsPath, false), isUrlsAvailableAria2c(urls, urlsPath, true)]);
	await fsp.unlink(urlsPath);
	return urls.map((_, i) => [urlsNoGzip[i], urlsGzip[i]]);
};
const downloadFile$3 = async (url, destPath, rateLimit = "0", gzip = false) => new Promise((resolve) => {
	const args = [
		"--console-log-level",
		"error",
		"--max-overall-download-limit",
		rateLimit,
		"-o",
		destPath,
		url
	];
	if (gzip) args.push("--http-accept-gzip");
	const child = childProcess.spawn("aria2c", args);
	child.on("error", () => resolve(RET_CODE.UNKNOWN_ERROR));
	child.on("close", (code) => resolve(code || RET_CODE.OK));
});

//#endregion
//#region src/downloaders/curl.ts
const getIsUrlsAvailableCurl = (urls, gzip) => new Promise((resolve) => {
	const args = [
		"--parallel",
		"--parallel-immediate",
		"--parallel-max",
		"10",
		"--head",
		"-s",
		"-w",
		"[\"%{url_effective}\",\"%{http_code}\"]\r\n"
	];
	if (gzip) args.push("-H", "Accept-Encoding: deflate, gzip");
	args.push(...urls);
	const child = childProcess.spawn("curl", args);
	let data = "";
	child.stdout.on("data", (chunk) => data += chunk);
	child.on("error", () => resolve([]));
	child.on("close", () => {
		const responses = data.split("\r\n").filter((line) => line.startsWith("[\"")).map((line) => JSON.parse(line));
		const result = [];
		for (const url of urls) {
			const response = responses.find((res) => res[0] === url);
			if (!response) result.push(false);
			else result.push(response[1] === "200");
		}
		resolve(result);
	});
});
const isUrlsAvailable$2 = async (urls) => {
	const [urlsNoGzip, urlsGzip] = await Promise.all([getIsUrlsAvailableCurl(urls, false), getIsUrlsAvailableCurl(urls, true)]);
	return urls.map((_, i) => [urlsNoGzip[i], urlsGzip[i]]);
};
const downloadFile$2 = async (url, destPath, retries, rateLimit = "0", gzip = false) => new Promise((resolve) => {
	const args = [
		"-o",
		destPath,
		"--retry",
		`${retries}`,
		"--retry-delay",
		"1",
		"--limit-rate",
		rateLimit,
		"--fail",
		url
	];
	if (gzip) args.push("-H", "Accept-Encoding: deflate, gzip");
	const child = childProcess.spawn("curl", args);
	child.on("error", () => resolve(RET_CODE.UNKNOWN_ERROR));
	child.on("close", (code) => resolve(code || RET_CODE.OK));
});

//#endregion
//#region src/downloaders/fetch.ts
const isUrlsAvailableFetch = async (urls, gzip) => {
	try {
		const responses = await Promise.all(urls.map((url) => fetch(url, { headers: { "Accept-Encoding": gzip ? "deflate, gzip" : "" } })));
		return responses.map((res) => res.ok);
	} catch (e) {
		return urls.map(() => false);
	}
};
const isUrlsAvailable$1 = async (urls) => {
	const [urlsNoGzip, urlsGzip] = await Promise.all([isUrlsAvailableFetch(urls, false), isUrlsAvailableFetch(urls, true)]);
	return urls.map((_, i) => [urlsNoGzip[i], urlsGzip[i]]);
};
const downloadFile$1 = async (url, destPath, gzip = true) => {
	try {
		const res = await fetch(url, { headers: { "Accept-Encoding": gzip ? "deflate, gzip" : "" } });
		if (!res.ok) return RET_CODE.HTTP_RETURNED_ERROR;
		const fileStream = fs.createWriteStream(destPath, { flags: "wx" });
		await stream.promises.finished(stream.Readable.fromWeb(res.body).pipe(fileStream));
		return RET_CODE.OK;
	} catch (e) {
		return RET_CODE.UNKNOWN_ERROR;
	}
};

//#endregion
//#region src/downloaders/index.ts
const [ARIA2C$1, CURL$1, FETCH$1] = DOWNLOADERS;
const downloadFile = async (downloader, url, destPath, rateLimit, gzip, retries = 5) => {
	if (downloader === CURL$1) return downloadFile$2(url, destPath, retries, rateLimit, gzip);
	for (const [i] of Object.entries(Array.from({ length: retries }))) {
		let retCode = RET_CODE.OK;
		if (downloader === ARIA2C$1) retCode = await downloadFile$3(url, destPath, rateLimit, gzip);
		if (downloader === FETCH$1) retCode = await downloadFile$1(url, destPath, gzip);
		if (retCode === RET_CODE.OK || retCode === RET_CODE.HTTP_RETURNED_ERROR) return retCode;
		setTimeout(1e3);
		console.error(`[download] Cannot download the url. Retry ${i + 1}`);
	}
	return RET_CODE.UNKNOWN_ERROR;
};
const IS_URLS_AVAILABLE_MAP = {
	[ARIA2C$1]: isUrlsAvailable$3,
	[CURL$1]: isUrlsAvailable$2,
	[FETCH$1]: isUrlsAvailable$1
};
const isUrlsAvailable = async (downloader, urls) => IS_URLS_AVAILABLE_MAP[downloader](urls);

//#endregion
//#region src/lib/isInstalled.ts
const isInstalled = (cmd) => new Promise((resolve) => {
	const child = childProcess.spawn(cmd);
	child.on("error", (e) => resolve(e.code !== "ENOENT"));
	child.on("close", () => resolve(true));
});

//#endregion
//#region src/lib/statsOrNull.ts
const statsOrNull = async (path$1) => {
	try {
		return await fsp.stat(path$1);
	} catch (e) {
		return null;
	}
};

//#endregion
//#region src/utils/getExistingFrags.ts
const getExistingFrags = (frags, outputPath, dir) => frags.filter((frag) => {
	const fragPath = getPath.frag(outputPath, frag.idx + 1);
	return dir.includes(path.parse(fragPath).base);
});

//#endregion
//#region src/lib/m3u8.ts
const PLAYLIST_LINE_KV_REGEX = /(?<key>[A-Z-]+)=(?:"(?<stringValue>[^"]+)"|(?<value>[^,]+))/g;
const parseAttrs = (line) => {
	const attrs = {};
	for (const kv of line.matchAll(PLAYLIST_LINE_KV_REGEX)) {
		const { key, stringValue, value } = kv.groups;
		attrs[key] = value || stringValue || "";
	}
	return attrs;
};
const parsePlaylist = (playlist) => {
	const segments = [];
	const HEADER_TAGS = ["#EXTM3U", "#EXT-X-TWITCH-INFO"];
	const lines = playlist.split("\n").map((line) => line.trim()).filter(Boolean).filter((line) => !HEADER_TAGS.some((s) => line.startsWith(s)));
	for (let i = 0; i < lines.length; i += 3) {
		const media = parseAttrs(lines[i]);
		const streamInf = parseAttrs(lines[i + 1]);
		const [width, height] = streamInf.RESOLUTION ? streamInf.RESOLUTION.split("x").map((n) => Number.parseInt(n)) : [null, null];
		segments.push({
			groupId: media["GROUP-ID"],
			name: media.NAME,
			width,
			height,
			bandwidth: Number.parseInt(streamInf.BANDWIDTH),
			codecs: streamInf.CODECS,
			frameRate: streamInf["FRAME-RATE"] ? Number.parseFloat(streamInf["FRAME-RATE"]) : null,
			url: lines[i + 2]
		});
	}
	return segments;
};
const parseVod = (playlist) => {
	const EXTINF = "#EXTINF:";
	const lines = playlist.split("\n").map((s) => s.trim()).filter(Boolean).filter((line) => line.startsWith(EXTINF) || !line.startsWith("#"));
	const segments = [];
	for (let i = 0; i < lines.length; i += 2) segments.push({
		duration: lines[i].replace(EXTINF, "").replace(",", ""),
		url: lines[i + 1]
	});
	return segments;
};

//#endregion
//#region src/utils/parseDownloadSectionsArg.ts
const DOWNLOAD_SECTIONS_ERROR = "Wrong --download-sections syntax";
const DOWNLOAD_SECTIONS_REGEX = /^\*(?:(?:(?<startH>\d{1,2}):)?(?<startM>\d{1,2}):)?(?:(?<startS>\d{1,2}))-(?:(?:(?:(?<endH>\d{1,2}):)?(?<endM>\d{1,2}):)?(?:(?<endS>\d{1,2}))|(?<inf>inf))$/;
const parseDownloadSectionsArg = (downloadSectionsArg) => {
	if (!downloadSectionsArg) return null;
	const m = downloadSectionsArg.match(DOWNLOAD_SECTIONS_REGEX);
	if (!m) throw new Error(DOWNLOAD_SECTIONS_ERROR);
	const { startH, startM, startS, endH, endM, endS, inf } = m.groups;
	const startHN = startH ? Number.parseInt(startH) : 0;
	const startMN = startM ? Number.parseInt(startM) : 0;
	const startSN = startS ? Number.parseInt(startS) : 0;
	const endHN = endH ? Number.parseInt(endH) : 0;
	const endMN = endM ? Number.parseInt(endM) : 0;
	const endSN = endS ? Number.parseInt(endS) : 0;
	if (startMN >= 60 || startSN >= 60 || endMN >= 60 || endSN >= 60) throw new Error(DOWNLOAD_SECTIONS_ERROR);
	const startTime = startSN + startMN * 60 + startHN * 60 * 60;
	const endTime = inf ? Infinity : endSN + endMN * 60 + endHN * 60 * 60;
	if (startTime >= endTime) throw new Error(DOWNLOAD_SECTIONS_ERROR);
	return {
		startTime,
		endTime
	};
};

//#endregion
//#region src/utils/getFragsForDownloading.ts
const getFragsForDownloading = (playlistUrl, playlistContent, downloadSectionsArg) => {
	const baseUrl = playlistUrl.split("/").slice(0, -1).join("/");
	const frags = [];
	let offset = 0;
	let idx = 0;
	for (const { duration, url } of parseVod(playlistContent)) {
		frags.push({
			idx,
			offset,
			duration,
			url: `${baseUrl}/${url}`
		});
		offset += Number.parseFloat(duration);
		idx += 1;
	}
	const downloadSections = parseDownloadSectionsArg(downloadSectionsArg);
	if (!downloadSections) return frags;
	const { startTime, endTime } = downloadSections;
	const firstFragIdx = frags.findLastIndex((frag) => frag.offset <= startTime);
	const lastFragIdx = endTime === Infinity ? frags.length - 1 : frags.findIndex((frag) => frag.offset >= endTime);
	return frags.slice(firstFragIdx, lastFragIdx + 1);
};

//#endregion
//#region src/utils/getUnmutedFrag.ts
const [QUALITY, ANY, SAME_FORMAT, NONE] = UNMUTE_POLICIES;
const LOWER_AUDIO_QUALITY = ["160p30", "360p30"];
const SAME_FORMAT_SLUGS = ["audio_only", ...LOWER_AUDIO_QUALITY];
const getFormatSlug = (url) => url.split("/").at(-2);
const getUnmutedFrag = async (downloader, unmutePolicy, fragUrl, formats) => {
	if (unmutePolicy === NONE) return null;
	const currentFormatSlug = getFormatSlug(fragUrl);
	if (unmutePolicy === ANY && currentFormatSlug === "audio_only") unmutePolicy = SAME_FORMAT;
	if (!unmutePolicy) unmutePolicy = SAME_FORMAT_SLUGS.includes(currentFormatSlug) ? SAME_FORMAT : QUALITY;
	if (unmutePolicy === SAME_FORMAT) {
		const url = fragUrl.replace("-muted", "");
		const [available, availableGzip] = await isUrlsAvailable(downloader, [url]);
		if (available) return {
			sameFormat: true,
			url,
			gzip: false
		};
		if (availableGzip) return {
			sameFormat: true,
			url,
			gzip: true
		};
		return null;
	}
	if (unmutePolicy === ANY || unmutePolicy === QUALITY) {
		const urls = [];
		let currentFormatIdx = -1;
		for (let i = 0; i < formats.length; i += 1) {
			const formatSlug = getFormatSlug(formats[i].url);
			if (unmutePolicy === QUALITY && LOWER_AUDIO_QUALITY.includes(formatSlug)) continue;
			if (formatSlug === currentFormatSlug) currentFormatIdx = i;
			urls.push(fragUrl.replace("-muted", "").replace(`/${currentFormatSlug}/`, `/${formatSlug}/`));
		}
		const responses = await isUrlsAvailable(downloader, urls);
		let [available, availableGzip] = responses[currentFormatIdx];
		let url = urls[currentFormatIdx];
		if (available) return {
			sameFormat: true,
			url,
			gzip: false
		};
		if (availableGzip) return {
			sameFormat: true,
			url,
			gzip: true
		};
		const idx = responses.findLastIndex(([av, avGzip]) => av || avGzip);
		if (idx === -1) return null;
		[available, availableGzip] = responses[idx];
		url = urls[idx];
		if (available) return {
			sameFormat: false,
			url,
			gzip: false
		};
		if (availableGzip) return {
			sameFormat: false,
			url,
			gzip: true
		};
		return null;
	}
	throw new Error(`Unknown unmute policy: ${unmutePolicy}. Available: ${UNMUTE_POLICIES}`);
};

//#endregion
//#region src/lib/spawn.ts
const spawn = (command, args = [], silent = false) => new Promise((resolve, reject) => {
	const child = childProcess.spawn(command, args);
	if (!silent) {
		child.stdout.on("data", (data) => process.stdout.write(data));
		child.stderr.on("data", (data) => process.stderr.write(data));
	}
	child.on("error", (err) => reject(err));
	child.on("close", (code) => resolve(code));
});

//#endregion
//#region src/utils/processUnmutedFrags.ts
const processUnmutedFrags = async (frags, outputPath, dir) => {
	for (const frag of frags) {
		const fragPath = getPath.frag(outputPath, frag.idx + 1);
		const fragUnmutedPath = getPath.fragUnmuted(fragPath);
		const fragUnmutedFileName = path.parse(fragUnmutedPath).base;
		if (!dir.includes(fragUnmutedFileName)) continue;
		const fragUnmutedPathTmp = `${fragPath}.ts`;
		const retCode = await spawn("ffmpeg", [
			"-hide_banner",
			"-loglevel",
			"error",
			"-i",
			fragPath,
			"-i",
			fragUnmutedPath,
			"-c:a",
			"copy",
			"-c:v",
			"copy",
			"-map",
			"1:a:0",
			"-map",
			"0:v:0",
			"-y",
			fragUnmutedPathTmp
		]);
		const message = `[unmute] Adding audio to Frag${frag.idx + 1}`;
		if (retCode) {
			try {
				await fsp.unlink(fragUnmutedPathTmp);
			} catch {}
			console.error(`${message}. Failure`);
			continue;
		}
		await Promise.all([fsp.unlink(fragPath), fsp.unlink(fragUnmutedPath)]);
		await fsp.rename(fragUnmutedPathTmp, fragPath);
		console.log(`${message}. Success`);
	}
};

//#endregion
//#region src/utils/readOutputDir.ts
const readOutputDir = (outputPath) => fsp.readdir(path.parse(outputPath).dir || ".");

//#endregion
//#region src/utils/showProgress.ts
const UNITS = [
	"B",
	"KB",
	"MB",
	"GB",
	"TB",
	"PB",
	"EB",
	"ZB",
	"YB"
];
const LOCALE = "en-GB";
const percentFormatter = new Intl.NumberFormat(LOCALE, {
	style: "percent",
	minimumFractionDigits: 1,
	maximumFractionDigits: 1
});
const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
	hour: "numeric",
	minute: "numeric",
	second: "numeric",
	timeZone: "GMT"
});
const formatSpeed = (n) => {
	const i = n === 0 ? 0 : Math.floor(Math.log(n) / Math.log(1024));
	const value = n / Math.pow(1024, i);
	return `${value.toFixed(2)}${UNITS[i]}/s`;
};
const formatSize = (n) => {
	const i = n === 0 ? 0 : Math.floor(Math.log(n) / Math.log(1024));
	const value = n / Math.pow(1024, i);
	return `${value.toFixed(2)}${UNITS[i]}`;
};
const showProgress = (downloadedFrags, fragsCount) => {
	const downloadedSize = downloadedFrags.reduce((acc, f) => acc + f.size, 0);
	const avgFragSize = downloadedFrags.length ? downloadedSize / downloadedFrags.length : 0;
	const last5 = downloadedFrags.filter((f) => f.time !== 0).slice(-5);
	const currentSpeedBps = last5.length ? last5.map((f) => f.size / f.time * 1e3).reduce((a, b) => a + b, 0) / last5.length : 0;
	const estFullSize = avgFragSize * fragsCount;
	const estSizeLeft = estFullSize - downloadedSize;
	const estTimeLeftSec = currentSpeedBps ? estSizeLeft / currentSpeedBps : 0;
	const downloadedPercent = estFullSize ? downloadedSize / estFullSize : 0;
	const progress = [
		"[download] ",
		COLOR.cyan,
		percentFormatter.format(downloadedPercent || 0).padStart(6, " "),
		COLOR.reset,
		" of ~ ",
		formatSize(estFullSize || 0).padStart(9, " "),
		" at ",
		COLOR.green,
		formatSpeed(currentSpeedBps || 0).padStart(11, " "),
		COLOR.reset,
		" ETA ",
		COLOR.yellow,
		timeFormatter.format((estTimeLeftSec || 0) * 1e3),
		COLOR.reset,
		` (frag ${downloadedFrags.length}/${fragsCount})\r`
	].join("");
	process.stdout.write(progress);
};

//#endregion
//#region src/utils/downloadVideo.ts
const DEFAULT_OUTPUT_TEMPLATE = "%(title)s [%(id)s].%(ext)s";
const WAIT_BETWEEN_CYCLES_SEC = 60;
const RETRY_MESSAGE = `Retry every ${WAIT_BETWEEN_CYCLES_SEC} second(s)`;
const downloadFrag = async (downloader, url, destPath, limitRateArg, gzip) => {
	const destPathTmp = `${destPath}.part`;
	if (await statsOrNull(destPathTmp)) await fsp.unlink(destPathTmp);
	const startTime = Date.now();
	const retCode = await downloadFile(downloader, url, destPathTmp, limitRateArg, gzip);
	const endTime = Date.now();
	if (retCode !== RET_CODE.OK) {
		try {
			await fsp.unlink(destPathTmp);
		} catch {}
		return {
			size: 0,
			time: 0
		};
	}
	await fsp.rename(destPathTmp, destPath);
	const { size } = await fsp.stat(destPath);
	return {
		size,
		time: endTime - startTime
	};
};
const isVideoOlderThat24h = (videoInfo) => {
	const videoDate = videoInfo.upload_date || videoInfo.release_date;
	if (!videoDate) return null;
	const now = Date.now();
	const videoDateMs = new Date(videoDate).getTime();
	return now - videoDateMs > 24 * 60 * 60 * 1e3;
};
const downloadVideo = async (formats, videoInfo, args, getLiveVideoStatus$1 = () => LIVE_VIDEO_STATUS.FINALIZED) => {
	if (args["list-formats"]) {
		console.table(formats.map(({ url,...rest }) => rest));
		process.exit();
	}
	if (!await isInstalled("ffmpeg")) throw new Error("ffmpeg is not installed. Install it from https://ffmpeg.org/");
	const dlFormat = args.format === "best" ? formats[0] : formats.find((f) => f.format_id === args.format);
	if (!dlFormat) throw new Error("Wrong format");
	const outputPath = getPath.output(args.output || DEFAULT_OUTPUT_TEMPLATE, videoInfo);
	let liveVideoStatus;
	let frags;
	let fragsCount = 0;
	let playlistUrl = dlFormat.url;
	const downloadedFrags = [];
	while (true) {
		let playlist;
		[playlist, liveVideoStatus] = await Promise.all([fetchText(playlistUrl, "playlist"), getLiveVideoStatus$1()]);
		if (!playlist) {
			const newPlaylistUrl = dlFormat.url.replace(/-muted-\w+(?=\.m3u8$)/, "");
			if (newPlaylistUrl !== playlistUrl) {
				playlistUrl = newPlaylistUrl;
				playlist = await fetchText(playlistUrl, "playlist (attempt #2)");
			}
		}
		if (!playlist && liveVideoStatus === LIVE_VIDEO_STATUS.FINALIZED) throw new Error("Cannot download the playlist");
		if (!playlist) {
			console.warn(`[live-from-start] Waiting for the playlist. ${RETRY_MESSAGE}`);
			await setTimeout(WAIT_BETWEEN_CYCLES_SEC * 1e3);
			continue;
		}
		frags = getFragsForDownloading(playlistUrl, playlist, args["download-sections"]);
		await fsp.writeFile(getPath.playlist(outputPath), playlist);
		const hasNewFrags = frags.length > fragsCount;
		fragsCount = frags.length;
		if (!hasNewFrags && liveVideoStatus !== LIVE_VIDEO_STATUS.FINALIZED) {
			let message = "[live-from-start] ";
			message += liveVideoStatus === LIVE_VIDEO_STATUS.ONLINE ? `${COLOR.green}VOD ONLINE${COLOR.reset}: waiting for new fragments` : `${COLOR.red}VOD OFFLINE${COLOR.reset}: waiting for the finalization`;
			console.log(`${message}. ${RETRY_MESSAGE}`);
			await setTimeout(WAIT_BETWEEN_CYCLES_SEC * 1e3);
			continue;
		}
		let downloadedFragments = 0;
		for (const [i, frag] of frags.entries()) {
			showProgress(downloadedFrags, fragsCount);
			const fragPath = getPath.frag(outputPath, frag.idx + 1);
			const fragStats = await statsOrNull(fragPath);
			if (fragStats) {
				if (!downloadedFrags[i]) {
					downloadedFrags[i] = {
						size: fragStats.size,
						time: 0
					};
					showProgress(downloadedFrags, fragsCount);
				}
				continue;
			}
			if (frag.url.endsWith("-unmuted.ts")) frag.url = frag.url.replace("-unmuted", "-muted");
			let unmutedFrag = null;
			if (frag.url.endsWith("-muted.ts") && !isVideoOlderThat24h(videoInfo)) unmutedFrag = await getUnmutedFrag(args.downloader, args.unmute, frag.url, formats);
			let fragGzip = void 0;
			if (unmutedFrag && unmutedFrag.sameFormat) {
				frag.url = unmutedFrag.url;
				fragGzip = unmutedFrag.gzip;
			}
			const fragMeta = await downloadFrag(args.downloader, frag.url, fragPath, args["limit-rate"], fragGzip);
			downloadedFrags.push(fragMeta);
			downloadedFragments += 1;
			if (unmutedFrag && !unmutedFrag.sameFormat) await downloadFrag(args.downloader, unmutedFrag.url, getPath.fragUnmuted(fragPath), args["limit-rate"], unmutedFrag.gzip);
			showProgress(downloadedFrags, fragsCount);
		}
		process.stdout.write("\n");
		if (liveVideoStatus === LIVE_VIDEO_STATUS.FINALIZED) break;
	}
	const dir = await readOutputDir(outputPath);
	const existingFrags = getExistingFrags(frags, outputPath, dir);
	await processUnmutedFrags(existingFrags, outputPath, dir);
	await mergeFrags(args["merge-method"], existingFrags, outputPath, args["keep-fragments"]);
};

//#endregion
//#region src/utils/getVideoInfo.ts
const DEFAULT_TITLE = "Untitled Broadcast";
const getVideoInfoByVideoMeta = (videoMeta) => ({
	id: `v${videoMeta.id}`,
	title: videoMeta.title || DEFAULT_TITLE,
	description: videoMeta.description,
	duration: videoMeta.lengthSeconds,
	uploader: videoMeta.owner.displayName,
	uploader_id: videoMeta.owner.login,
	upload_date: videoMeta.createdAt,
	release_date: videoMeta.publishedAt,
	view_count: videoMeta.viewCount,
	ext: "mp4"
});
const getVideoInfoByStreamMeta = (streamMeta, channelLogin) => ({
	id: `v${streamMeta.lastBroadcast.id}`,
	title: streamMeta.lastBroadcast.title || DEFAULT_TITLE,
	description: null,
	duration: null,
	uploader: channelLogin,
	uploader_id: streamMeta.id,
	upload_date: streamMeta.stream.createdAt,
	release_date: streamMeta.stream.createdAt,
	view_count: null,
	ext: "mp4"
});
const getVideoInfoByVodPath = ({ channelLogin, videoId, startTimestamp }) => ({
	id: `v${videoId}`,
	title: `${channelLogin}_${startTimestamp}`,
	description: null,
	duration: null,
	uploader: channelLogin,
	uploader_id: null,
	upload_date: new Date(startTimestamp * 1e3).toISOString(),
	release_date: new Date(startTimestamp * 1e3).toISOString(),
	view_count: null,
	ext: "mp4"
});

//#endregion
//#region src/utils/downloadWithStreamlink.ts
const DEFAULT_STREAMLINK_ARGS = ["--twitch-force-client-integrity", "--twitch-access-token-param=playerType=frontpage"];
const getDefaultOutputTemplate = () => {
	const now = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "_");
	return `%(uploader)s (live) ${now} [%(id)s].%(ext)s`;
};
const downloadWithStreamlink = async (link, streamMeta, channelLogin, args) => {
	if (!await isInstalled("streamlink")) throw new Error("streamlink is not installed. Install it from https://streamlink.github.io/");
	if (args["list-formats"]) {
		await spawn("streamlink", ["-v", link]);
		process.exit();
	}
	const outputPath = getPath.output(args.output || getDefaultOutputTemplate(), getVideoInfoByStreamMeta(streamMeta, channelLogin));
	const streamlinkArgs = [];
	for (const argName of Object.keys(args)) {
		if (!argName.startsWith("twitch-")) continue;
		const argValue = args[argName];
		if (argValue === void 0) continue;
		if (Array.isArray(argValue)) for (const v of argValue) streamlinkArgs.push(`--${argName}=${v}`);
		else streamlinkArgs.push(typeof argValue === "boolean" ? `--${argName}` : `--${argName}=${argValue}`);
	}
	return spawn("streamlink", [
		"-o",
		outputPath,
		link,
		args.format,
		...streamlinkArgs.length ? streamlinkArgs : DEFAULT_STREAMLINK_ARGS
	]);
};

//#endregion
//#region src/utils/getDownloader.ts
const FETCH_WARNING = "Warning: --limit-rate (-r) option is not supported by default downloader. Install aria2c or curl";
const [ARIA2C, CURL, FETCH] = DOWNLOADERS;
const getDownloader = async (downloaderArg, limitRateArg) => {
	if (downloaderArg === FETCH) {
		if (!limitRateArg) return FETCH;
		console.warn(FETCH_WARNING);
		return FETCH;
	}
	if (!downloaderArg) {
		if (!limitRateArg) return FETCH;
		const [aria2cInstalled, curlInstalled] = await Promise.all([isInstalled(ARIA2C), isInstalled(CURL)]);
		if (curlInstalled) return CURL;
		if (aria2cInstalled) return ARIA2C;
		console.warn(FETCH_WARNING);
		return FETCH;
	}
	if (downloaderArg === ARIA2C) {
		if (await isInstalled(ARIA2C)) return ARIA2C;
		throw new Error(`${ARIA2C} is not installed. Install it from https://aria2.github.io/`);
	}
	if (downloaderArg === CURL) {
		if (await isInstalled(CURL)) return CURL;
		const curlLink = os.platform() === "win32" ? "https://curl.se/windows/" : "https://curl.se/download.html";
		throw new Error(`${CURL} is not installed. Install it from ${curlLink}`);
	}
	throw new Error(`Unknown downloader: ${downloaderArg}. Available: ${DOWNLOADERS}`);
};

//#endregion
//#region src/utils/parseDownloadFormats.ts
const parseDownloadFormats = (playlistContent) => {
	const formats = [];
	for (const { name, width, height, url } of parsePlaylist(playlistContent)) formats.push({
		format_id: name.replaceAll(" ", "_"),
		width,
		height,
		url
	});
	return formats;
};

//#endregion
//#region src/utils/getVideoFormats.ts
const FORMATS = [
	"chunked",
	"720p60",
	"720p30",
	"480p30",
	"360p30",
	"160p30",
	"audio_only"
];
const FORMATS_MAP = {
	chunked: "Source",
	audio_only: "Audio_Only"
};
const getVideoFormats = async (videoId) => {
	const accessToken = await getVideoAccessToken(videoId);
	if (!accessToken) return [];
	const manifest = await getManifest(videoId, accessToken);
	if (!manifest) return [];
	const formats = parseDownloadFormats(manifest);
	formats.sort((a, b) => (b.width || 0) - (a.width || 0));
	return formats;
};
const getFullVodPath = (vodPath) => {
	const hashedVodPath = crypto.createHash("sha1").update(vodPath).digest("hex").slice(0, 20);
	return `${hashedVodPath}_${vodPath}`;
};
const getVodUrl = (vodDomain, fullVodPath, broadcastType = "ARCHIVE", videoId = "", format = "chunked") => {
	const playlistName = broadcastType === "HIGHLIGHT" ? `highlight-${videoId}` : "index-dvr";
	return `${vodDomain}/${fullVodPath}/${format}/${playlistName}.m3u8`;
};
const getAvailableFormats = async (vodDomain, fullVodPath, broadcastType, videoId) => {
	const formats = [];
	const formatUrls = FORMATS.map((format) => getVodUrl(vodDomain, fullVodPath, broadcastType, videoId, format));
	const responses = await Promise.all(formatUrls.map((url) => fetch(url, { method: "HEAD" })));
	for (const [i, res] of responses.entries()) {
		if (!res.ok) continue;
		const format = FORMATS[i];
		formats.push({
			format_id: FORMATS_MAP[format] || format,
			url: formatUrls[i]
		});
	}
	return formats;
};
const getVideoFormatsByFullVodPath = async (fullVodPath, broadcastType, videoId) => {
	const responses = await Promise.all(VOD_DOMAINS.map((domain) => {
		const url = getVodUrl(domain, fullVodPath, broadcastType, videoId);
		return fetch(url, { method: "HEAD" });
	}));
	const vodDomainIdx = responses.findIndex((res) => res.ok);
	if (vodDomainIdx === -1) return [];
	return getAvailableFormats(VOD_DOMAINS[vodDomainIdx], fullVodPath, broadcastType, videoId);
};
const THUMB_REGEX = /cf_vods\/(?<subdomain>[^\/]+)\/(?<fullVodPath>(?:[^\/]+|[^\/]+\/[^\/]+\/[^\/]+))\/?\/thumb\//;
const getVideoFormatsByThumbUrl = (broadcastType, videoId, thumbUrl) => {
	const m = thumbUrl.match(THUMB_REGEX);
	if (!m) return [];
	const { fullVodPath } = m.groups;
	return getVideoFormatsByFullVodPath(fullVodPath, broadcastType, videoId);
};

//#endregion
//#region src/utils/getLiveVideoInfo.ts
const getLiveVideoInfo = async (streamMeta, channelLogin) => {
	let formats = [];
	let videoInfo = null;
	let videoId = null;
	if (!streamMeta.stream) throw new Error();
	const broadcast = await getBroadcast(streamMeta.id);
	if (broadcast?.stream?.archiveVideo) {
		videoId = broadcast.stream.archiveVideo.id;
		let videoMeta;
		[formats, videoMeta] = await Promise.all([getVideoFormats(videoId), getVideoMetadata(videoId)]);
		if (videoMeta) videoInfo = getVideoInfoByVideoMeta(videoMeta);
	}
	if (!broadcast?.stream?.archiveVideo || formats.length === 0) {
		console.warn("[live-from-start] Recovering the playlist");
		const startTimestamp = new Date(streamMeta.stream.createdAt).getTime() / 1e3;
		const vodPath = `${channelLogin}_${streamMeta.stream.id}_${startTimestamp}`;
		formats = await getVideoFormatsByFullVodPath(getFullVodPath(vodPath));
		videoInfo = getVideoInfoByStreamMeta(streamMeta, channelLogin);
	}
	if (formats.length === 0 || !videoInfo) return null;
	return {
		formats,
		videoInfo,
		videoId
	};
};

//#endregion
//#region src/utils/getLiveVideoStatus.ts
const WAIT_AFTER_STREAM_ENDED_SECONDS = 8 * 60;
let lastLiveTimestamp = Date.now();
const getIsVideoLive = (thumbUrl) => /\/404_processing_[^.?#]+\.png/.test(thumbUrl);
const getSecondsAfterStreamEnded = (videoMeta) => {
	const started = new Date(videoMeta.publishedAt);
	const ended = new Date(started.getTime() + videoMeta.lengthSeconds * 1e3);
	return Math.floor((Date.now() - ended.getTime()) / 1e3);
};
const getLiveVideoStatus = async (videoId, streamId, channelLogin) => {
	let videoMeta = null;
	if (videoId) {
		videoMeta = await getVideoMetadata(videoId);
		if (videoMeta) {
			if (getIsVideoLive(videoMeta.previewThumbnailURL)) {
				lastLiveTimestamp = Date.now();
				return LIVE_VIDEO_STATUS.ONLINE;
			}
			const secondsAfterEnd = getSecondsAfterStreamEnded(videoMeta);
			return secondsAfterEnd - WAIT_AFTER_STREAM_ENDED_SECONDS > 0 ? LIVE_VIDEO_STATUS.FINALIZED : LIVE_VIDEO_STATUS.OFFLINE;
		}
	}
	if (!videoId || !videoMeta) {
		const streamMeta = await getStreamMetadata(channelLogin);
		if (streamMeta?.stream?.id === streamId) {
			lastLiveTimestamp = Date.now();
			return LIVE_VIDEO_STATUS.ONLINE;
		}
		const secondsAfterEnd = (Date.now() - lastLiveTimestamp) / 1e3;
		return secondsAfterEnd - WAIT_AFTER_STREAM_ENDED_SECONDS > 0 ? LIVE_VIDEO_STATUS.FINALIZED : LIVE_VIDEO_STATUS.OFFLINE;
	}
	throw new Error("Cannot determine stream status");
};

//#endregion
//#region src/utils/parseLink.ts
const VOD_PATH_REGEX = /^video:(?<vodPath>(?<channelLogin>\w+)_(?<videoId>\d+)_(?<startTimestamp>\d+))$/;
const VOD_REGEX = /^https:\/\/(?:www\.)?twitch\.tv\/videos\/(?<videoId>\d+)/;
const CHANNEL_REGEX = /^https:\/\/(?:www\.)?twitch\.tv\/(?<channelLogin>[^/#?]+)/;
const parseLink = (link) => {
	let m = link.match(VOD_PATH_REGEX);
	if (m) return {
		type: "vodPath",
		...m.groups
	};
	m = link.match(VOD_REGEX);
	if (m) return {
		type: "video",
		...m.groups
	};
	m = link.match(CHANNEL_REGEX);
	if (m) return {
		type: "channel",
		...m.groups
	};
	throw new Error("Wrong link");
};

//#endregion
//#region src/main.ts
const getArgs = () => parseArgs({
	args: process.argv.slice(2),
	options: {
		help: {
			type: "boolean",
			short: "h"
		},
		version: { type: "boolean" },
		format: {
			type: "string",
			short: "f",
			default: "best"
		},
		"list-formats": {
			type: "boolean",
			short: "F",
			default: false
		},
		output: {
			type: "string",
			short: "o"
		},
		downloader: { type: "string" },
		"keep-fragments": {
			type: "boolean",
			default: false
		},
		"limit-rate": {
			type: "string",
			short: "r"
		},
		"live-from-start": { type: "boolean" },
		"retry-streams": { type: "string" },
		"download-sections": { type: "string" },
		unmute: { type: "string" },
		"merge-fragments": { type: "boolean" },
		"merge-method": {
			type: "string",
			default: "ffconcat"
		},
		"twitch-disable-ads": { type: "boolean" },
		"twitch-low-latency": { type: "boolean" },
		"twitch-api-header": {
			type: "string",
			multiple: true
		},
		"twitch-access-token-param": {
			type: "string",
			multiple: true
		},
		"twitch-force-client-integrity": { type: "boolean" },
		"twitch-purge-client-integrity": { type: "boolean" }
	},
	allowPositionals: true
});
const main = async () => {
	const parsedArgs = getArgs();
	const args = parsedArgs.values;
	const positionals = parsedArgs.positionals;
	if (args.version) {
		const pkg = await fsp.readFile("./package.json", "utf8");
		console.log(JSON.parse(pkg).version);
		return;
	}
	if (args.help || parsedArgs.positionals.length === 0) {
		const readme = await fsp.readFile("./README.md", "utf8");
		const entries = readme.split(/\s## (.*)/g).slice(1);
		const sections = {};
		for (let i = 0; i < entries.length; i += 2) {
			const header = entries[i];
			const content = entries[i + 1].trim();
			sections[header] = content;
		}
		console.log("Options:");
		console.log(sections.Options.replace(/^```\w+\n(.*)\n```$/s, "$1"));
		console.log("");
		console.log("Dependencies:");
		console.log(sections.Dependencies.replaceAll("**", ""));
		return;
	}
	args.downloader = await getDownloader(args.downloader, args["limit-rate"]);
	if (!MERGE_METHODS.includes(args["merge-method"])) throw new Error(`Unknown merge method. Available: ${MERGE_METHODS}`);
	if (args["merge-fragments"]) {
		const [outputPath] = positionals;
		const [playlist, dir] = await Promise.all([fsp.readFile(getPath.playlist(outputPath), "utf8"), readOutputDir(outputPath)]);
		const frags = getFragsForDownloading(".", playlist, args["download-sections"]);
		const existingFrags = getExistingFrags(frags, outputPath, dir);
		await processUnmutedFrags(existingFrags, outputPath, dir);
		await mergeFrags(args["merge-method"], existingFrags, outputPath, true);
		return;
	}
	if (positionals.length > 1) throw new Error("Expected only one link");
	const [link] = positionals;
	const parsedLink = parseLink(link);
	if (parsedLink.type === "vodPath") {
		const formats = await getVideoFormatsByFullVodPath(getFullVodPath(parsedLink.vodPath));
		const videoInfo = getVideoInfoByVodPath(parsedLink);
		return downloadVideo(formats, videoInfo, args);
	}
	if (parsedLink.type === "video") {
		let [formats, videoMeta] = await Promise.all([getVideoFormats(parsedLink.videoId), getVideoMetadata(parsedLink.videoId)]);
		if (formats.length === 0 && videoMeta !== null) {
			console.log("Trying to get playlist from video metadata");
			formats = await getVideoFormatsByThumbUrl(videoMeta.broadcastType, videoMeta.id, videoMeta.previewThumbnailURL);
		}
		if (formats.length === 0 || !videoMeta) return console.log(PRIVATE_VIDEO_INSTRUCTIONS);
		const videoInfo = getVideoInfoByVideoMeta(videoMeta);
		return downloadVideo(formats, videoInfo, args);
	}
	const { channelLogin } = parsedLink;
	let retryStreamsDelay = 0;
	if (args["retry-streams"]) {
		retryStreamsDelay = Number.parseInt(args["retry-streams"]);
		if (!retryStreamsDelay || retryStreamsDelay < 0) throw new Error("Wrong --retry-streams delay");
	}
	const isLiveFromStart = args["live-from-start"];
	const isRetry = retryStreamsDelay > 0;
	while (true) {
		const streamMeta = await getStreamMetadata(channelLogin);
		const isLive = !!streamMeta?.stream;
		if (!isLive) if (isRetry) console.log(`[retry-streams] Waiting for streams. Retry every ${retryStreamsDelay} second(s)`);
		else {
			console.warn("[download] The channel is not currently live");
			return;
		}
		if (isLive && !isLiveFromStart) await downloadWithStreamlink(`https://www.twitch.tv/${channelLogin}`, streamMeta, channelLogin, args);
		if (isLive && isLiveFromStart) {
			const liveVideoInfo = await getLiveVideoInfo(streamMeta, channelLogin);
			if (liveVideoInfo) {
				const { formats, videoInfo, videoId } = liveVideoInfo;
				const getLiveVideoStatusFn = () => getLiveVideoStatus(videoId, streamMeta.stream.id, channelLogin);
				await downloadVideo(formats, videoInfo, args, getLiveVideoStatusFn);
			} else {
				let message = `[live-from-start] Cannot find the playlist`;
				if (isRetry) {
					message += `. Retry every ${retryStreamsDelay} second(s)`;
					console.warn(message);
				} else {
					console.warn(message);
					return;
				}
			}
		}
		await setTimeout(retryStreamsDelay * 1e3);
	}
};
main().catch((e) => {
	console.error(`${COLOR.red}ERROR:${COLOR.reset} ${e.message}`);
});

//#endregion