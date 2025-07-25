#!/usr/bin/env node
import { parseArgs } from "node:util";
import { setTimeout as setTimeout$1 } from "node:timers/promises";
import fsp from "node:fs/promises";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import stream from "node:stream";
import crypto from "node:crypto";

//#region node_modules/.pnpm/twitch-gql-queries@0.1.13/node_modules/twitch-gql-queries/dist/index.js
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
var getQueryShareClipRenderStatus = (variables) => ({
	operationName: "ShareClipRenderStatus",
	variables,
	extensions: { persistedQuery: {
		version: 1,
		sha256Hash: "f130048a462a0ac86bb54d653c968c514e9ab9ca94db52368c1179e97b0f16eb"
	} }
});
var getQueryStreamMetadata = (variables) => ({
	operationName: "StreamMetadata",
	variables,
	extensions: { persistedQuery: {
		version: 1,
		sha256Hash: "b57f9b910f8cd1a4659d894fe7550ccc81ec9052c01e438b290fd66a040b9b93"
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
const getStreamMetadata = (channelLogin) => apiRequest(getQueryStreamMetadata({
	channelLogin,
	includeIsDJ: false
}), "user", "stream metadata");
const getVideoMetadata = (videoId) => apiRequest(getQueryVideoMetadata({
	channelLogin: "",
	videoID: videoId
}), "video", "video metadata");
const getClipMetadata = (slug) => apiRequest(getQueryShareClipRenderStatus({ slug }), "clip", "clip metadata");
const getBroadcast = (channelId) => apiRequest(getQueryFfzBroadcastId({ id: channelId }), "user", "broadcast id");
const getManifest = (videoId, accessToken) => {
	const params = new URLSearchParams({
		allow_source: "true",
		allow_audio_only: "true",
		allow_spectre: "true",
		include_unavailable: "true",
		player: "twitchweb",
		playlist_include_framerate: "true",
		sig: accessToken.signature,
		supported_codecs: "av1,h265,h264",
		token: accessToken.value
	});
	const url = `https://usher.ttvnw.net/vod/${videoId}.m3u8?${params}`;
	return fetchText(url, "video manifest");
};

//#endregion
//#region src/constants.ts
const DEFAULT_OUTPUT_TEMPLATE = "%(title)s [%(id)s].%(ext)s";
const PRIVATE_VIDEO_INSTRUCTIONS = "This video might be private. Follow this article to download it: https://github.com/DmitryScaletta/twitch-dlp/blob/master/DOWNLOAD_PRIVATE_VIDEOS.md";
const NO_TRY_UNMUTE_MESSAGE = "[unmute] The video is old, not trying to unmute";
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
	"https://d3aqoihi2n8ty8.cloudfront.net",
	"https://d3fi1amfgojobc.cloudfront.net"
];
const DOWNLOADERS = [
	"aria2c",
	"curl",
	"fetch"
];
const MERGE_METHODS = ["ffconcat", "append"];
const UNMUTE = {
	QUALITY: "quality",
	ANY: "any",
	SAME_FORMAT: "same_format",
	OFF: "off"
};
const RET_CODE = {
	OK: 0,
	UNKNOWN_ERROR: 1,
	HTTP_RETURNED_ERROR: 22
};

//#endregion
//#region src/lib/chalk.ts
const styles = { color: {
	black: [30, 39],
	red: [31, 39],
	green: [32, 39],
	yellow: [33, 39],
	blue: [34, 39],
	magenta: [35, 39],
	cyan: [36, 39],
	white: [37, 39]
} };
const chalk = Object.entries(styles.color).reduce((acc, [color, [open, close]]) => {
	acc[color] = (s) => `\x1b[${open}m${s}\x1b[${close}m`;
	return acc;
}, {});

//#endregion
//#region src/lib/hlsParser.ts
const PLAYLIST_LINE_KV_REGEX = /(?<key>[A-Z-]+)=(?:"(?<stringValue>[^"]+)"|(?<value>[^,]+))/g;
const MASTER_PLAYLIST_TAGS = ["EXT-X-STREAM-INF", "EXT-X-MEDIA"];
const parseAttrs = (line) => {
	const attrs = {};
	for (const kv of line.matchAll(PLAYLIST_LINE_KV_REGEX)) {
		const { key, stringValue, value } = kv.groups;
		attrs[key] = value || stringValue || "";
	}
	return attrs;
};
const parseMasterPlaylist = (lines) => {
	const variants = [];
	const mediaLines = lines.filter((line) => MASTER_PLAYLIST_TAGS.some((s) => line.startsWith(`#${s}:`)) || !line.startsWith("#"));
	for (let i = 0; i < mediaLines.length; i += 3) {
		const media = parseAttrs(mediaLines[i]);
		const streamInf = parseAttrs(mediaLines[i + 1]);
		let resolution = void 0;
		if (streamInf.RESOLUTION) {
			const [width, height] = streamInf.RESOLUTION.split("x").map((n) => Number.parseInt(n));
			resolution = {
				width,
				height
			};
		}
		variants.push({
			uri: mediaLines[i + 2],
			bandwidth: Number.parseInt(streamInf.BANDWIDTH),
			codecs: streamInf.CODECS,
			resolution,
			frameRate: streamInf["FRAME-RATE"] ? Number.parseFloat(streamInf["FRAME-RATE"]) : void 0,
			video: [{
				type: "VIDEO",
				groupId: media["GROUP-ID"],
				name: media.NAME,
				isDefault: media.DEFAULT === "YES",
				autoselect: media.AUTOSELECT === "YES"
			}]
		});
	}
	const sessionDataList = [];
	for (const line of lines) if (line.startsWith("#EXT-X-SESSION-DATA:")) {
		const sessionData = parseAttrs(line);
		sessionDataList.push({
			id: sessionData["DATA-ID"],
			value: sessionData.VALUE
		});
	}
	return {
		type: "playlist",
		isMasterPlaylist: true,
		variants,
		sessionDataList
	};
};
const parseMediaPlaylist = (lines) => {
	const EXTINF = "#EXTINF:";
	const EXT_X_MAP = "#EXT-X-MAP:";
	let map = null;
	let mapLine = lines.find((line) => line.startsWith(EXT_X_MAP));
	if (mapLine) {
		const mapData = parseAttrs(mapLine);
		if (mapData?.URI) map = { uri: mapData.URI };
	}
	const segLines = lines.filter((line) => line.startsWith(EXTINF) || !line.startsWith("#"));
	const segments = [];
	for (let i = 0; i < segLines.length; i += 2) segments.push({
		type: "segment",
		uri: segLines[i + 1],
		duration: Number.parseFloat(segLines[i].replace(EXTINF, "").replace(",", "")),
		map
	});
	const endlist = lines.includes("#EXT-X-ENDLIST");
	return {
		type: "playlist",
		isMasterPlaylist: false,
		endlist,
		segments
	};
};
const parse = (playlist) => {
	const lines = playlist.split("\n").map((line) => line.trim()).filter(Boolean);
	const isMasterPlaylist = MASTER_PLAYLIST_TAGS.some((s) => lines.some((line) => line.startsWith(`#${s}:`)));
	return isMasterPlaylist ? parseMasterPlaylist(lines) : parseMediaPlaylist(lines);
};

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
//#region src/utils/getPath.ts
const ILLEGAL_PATH_CHARS_MAP = {
	"\\": "⧹",
	"/": "⧸",
	":": "：",
	"*": "＊",
	"?": "？",
	"\"": "＂",
	"<": "＜",
	">": "＞",
	"|": "｜"
};
const sanitizeFilename = (str) => {
	const chars = Object.keys(ILLEGAL_PATH_CHARS_MAP);
	const regex = `[${chars.map((c) => c === "\\" ? "\\\\" : c).join("")}]`;
	return str.replace(new RegExp(regex, "g"), (c) => ILLEGAL_PATH_CHARS_MAP[c]);
};
const getOutputPath = (template, videoInfo) => {
	let outputPath = template;
	for (const [key, value] of Object.entries(videoInfo)) {
		let newValue = value ? `${value}` : "";
		if (key.endsWith("_date")) newValue = newValue.slice(0, 10);
		newValue = sanitizeFilename(newValue);
		outputPath = outputPath.replaceAll(`%(${key})s`, newValue);
	}
	return path.resolve(outputPath);
};
const getPath = {
	output: getOutputPath,
	ffconcat: (filePath) => `${filePath}-ffconcat.txt`,
	playlist: (filePath) => `${filePath}-playlist.m3u8`,
	log: (filePath) => `${filePath}-log.tsv`,
	frag: (filePath, i) => `${filePath}.part-Frag${i}`,
	fragUnmuted: (fragPath) => `${fragPath}-unmuted`
};

//#endregion
//#region src/merge/append.ts
const concatFrags = async (files, outputPath) => {
	const writeStream = fs.createWriteStream(outputPath, { flags: "w" });
	try {
		for (const file of files) await new Promise((resolve, reject) => {
			const readStream = fs.createReadStream(file);
			readStream.pipe(writeStream, { end: false });
			readStream.on("end", resolve);
			readStream.on("error", reject);
		});
	} catch (error) {
		throw error;
	} finally {
		writeStream.end();
	}
};
const mergeFrags$2 = async (frags, outputPath, keepFragments) => {
	const fragFiles = frags.map((frag) => getPath.frag(outputPath, frag.idx + 1));
	await concatFrags(fragFiles, outputPath);
	const parsed = path.parse(outputPath);
	const outputPathTmp = path.join(parsed.dir, `${parsed.name}.temp.mp4`);
	await spawn("ffmpeg", [
		"-y",
		"-loglevel",
		"repeat+info",
		"-i",
		`file:${outputPath}`,
		"-map",
		"0",
		"-dn",
		"-ignore_unknown",
		"-c",
		"copy",
		"-f",
		"mp4",
		"-bsf:a",
		"aac_adtstoasc",
		"-movflags",
		"+faststart",
		`file:${outputPathTmp}`
	]);
	await fsp.unlink(outputPath);
	await fsp.rename(outputPathTmp, outputPath);
	if (!keepFragments) await Promise.all([...fragFiles.map((filename) => fsp.unlink(filename)), fsp.unlink(getPath.playlist(outputPath))]);
};

//#endregion
//#region src/merge/ffconcat.ts
const MAX_INT_STR = "2147483647";
const spawnFfmpeg = (args) => new Promise((resolve, reject) => {
	let isInputSection = true;
	let prevLinePart = "";
	const handleFfmpegData = (stream$1) => (data) => {
		if (!isInputSection) return stream$1.write(data);
		const lines = data.toString().split("\n");
		lines[0] = prevLinePart + lines[0];
		prevLinePart = lines.pop() || "";
		for (const line of lines) {
			if (line.startsWith("  Stream #")) continue;
			if (line.startsWith("Stream mapping:")) isInputSection = false;
			stream$1.write(line + "\n");
		}
		if (!isInputSection) stream$1.write(prevLinePart);
	};
	const child = childProcess.spawn("ffmpeg", args);
	child.stdout.on("data", handleFfmpegData(process.stdout));
	child.stderr.on("data", handleFfmpegData(process.stderr));
	child.on("error", () => reject(1));
	child.on("close", (code) => resolve(code || 0));
});
const runFfconcat = (ffconcatFilename, outputFilename) => spawnFfmpeg([
	"-hide_banner",
	"-avoid_negative_ts",
	"make_zero",
	"-analyzeduration",
	MAX_INT_STR,
	"-probesize",
	MAX_INT_STR,
	"-max_streams",
	MAX_INT_STR,
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
		`file '${file.replaceAll("'", "'\\''")}'`,
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
	if (!keepFragments) await Promise.all([...fragFiles.map(([filename]) => fsp.unlink(filename)), fsp.unlink(getPath.playlist(outputPath))]);
	return retCode;
};

//#endregion
//#region src/merge/index.ts
const [FFCONCAT, APPEND] = MERGE_METHODS;
const mergeFrags = async (method, frags, outputPath, keepFragments) => {
	if (frags.length === 0) {
		console.error(`${chalk.red("ERROR:")} No fragments were downloaded`);
		return 1;
	}
	if (method === FFCONCAT && frags.isFMp4) {
		console.warn(`${chalk.yellow("WARN:")} ${FFCONCAT} merge method is not supported for fMP4 streams. Using ${APPEND} instead`);
		method = APPEND;
	}
	if (method === FFCONCAT) return mergeFrags$1(frags, outputPath, keepFragments);
	if (method === APPEND) return mergeFrags$2(frags, outputPath, keepFragments);
	throw new Error();
};

//#endregion
//#region src/lib/groupBy.ts
const groupBy = (array, getKey) => array.reduce((groups, item) => {
	const key = getKey(item);
	if (!groups[key]) groups[key] = [];
	groups[key].push(item);
	return groups;
}, {});

//#endregion
//#region src/stats.ts
const DL_EVENT = {
	INIT: "INIT",
	FETCH_PLAYLIST_SUCCESS: "FETCH_PLAYLIST_SUCCESS",
	FETCH_PLAYLIST_FAILURE: "FETCH_PLAYLIST_FAILURE",
	FETCH_PLAYLIST_OLD_MUTED_SUCCESS: "FETCH_PLAYLIST_OLD_MUTED_SUCCESS",
	FETCH_PLAYLIST_OLD_MUTED_FAILURE: "FETCH_PLAYLIST_OLD_MUTED_FAILURE",
	FRAGS_FOR_DOWNLOADING: "FRAGS_FOR_DOWNLOADING",
	FRAGS_EXISTING: "FRAGS_EXISTING",
	FRAG_ALREADY_EXISTS: "FRAG_ALREADY_EXISTS",
	FRAG_RENAME_UNMUTED: "FRAG_RENAME_UNMUTED",
	FRAG_MUTED: "FRAG_MUTED",
	FRAG_UNMUTE_SUCCESS: "FRAG_UNMUTE_SUCCESS",
	FRAG_UNMUTE_FAILURE: "FRAG_UNMUTE_FAILURE",
	FRAG_DOWNLOAD_SUCCESS: "FRAG_DOWNLOAD_SUCCESS",
	FRAG_DOWNLOAD_FAILURE: "FRAG_DOWNLOAD_FAILURE",
	FRAG_DOWNLOAD_UNMUTED_SUCCESS: "FRAG_DOWNLOAD_UNMUTED_SUCCESS",
	FRAG_DOWNLOAD_UNMUTED_FAILURE: "FRAG_DOWNLOAD_UNMUTED_FAILURE",
	FRAG_REPLACE_AUDIO_SUCCESS: "FRAG_REPLACE_AUDIO_SUCCESS",
	FRAG_REPLACE_AUDIO_FAILURE: "FRAG_REPLACE_AUDIO_FAILURE",
	MERGE_FRAGS_SUCCESS: "MERGE_FRAGS_SUCCESS",
	MERGE_FRAGS_FAILURE: "MERGE_FRAGS_FAILURE"
};
const createLogger = (logPath) => (event) => {
	const line = event.map((v) => JSON.stringify(v)).join("	");
	return fsp.appendFile(logPath, `${line}\n`);
};
const nameEq = (name) => (event) => event[0] === name;
const getLog = async (logPath) => {
	try {
		const logContent = await fsp.readFile(logPath, "utf8");
		return logContent.split("\n").filter(Boolean).map((line) => line.split("	").map((v) => JSON.parse(v)));
	} catch {
		return null;
	}
};
const logUnmuteResult = (unmuteResult, fragIdx) => {
	if (unmuteResult) {
		const { sameFormat, gzip, url } = unmuteResult;
		return [
			DL_EVENT.FRAG_UNMUTE_SUCCESS,
			fragIdx,
			sameFormat,
			gzip,
			url
		];
	} else return [DL_EVENT.FRAG_UNMUTE_FAILURE, fragIdx];
};
const logFragsForDownloading = (frags) => {
	const firstFragIdx = frags.isFMp4 ? 1 : 0;
	return [
		DL_EVENT.FRAGS_FOR_DOWNLOADING,
		frags[firstFragIdx]?.idx || 0,
		frags[frags.length - 1]?.idx || 0
	];
};
const getFragsInfo = (log) => {
	const fragsInfo = {};
	const fragsGroupedByIdx = groupBy(log.filter(([name]) => name.startsWith("FRAG_")), (e) => e[1]);
	for (const [fragIdx, events] of Object.entries(fragsGroupedByIdx)) {
		const fragInfo = {
			muted: null,
			unmuteSuccess: null,
			unmuteSameFormat: null,
			dlSuccess: null,
			dlUnmutedSuccess: null,
			replaceAudioSuccess: null
		};
		fragsInfo[fragIdx] = fragInfo;
		if (!events) continue;
		fragInfo.muted = !!events.findLast(nameEq(DL_EVENT.FRAG_MUTED));
		const unmuteSuccess = events.findLast(nameEq(DL_EVENT.FRAG_UNMUTE_SUCCESS));
		fragInfo.unmuteSuccess = !!unmuteSuccess;
		fragInfo.unmuteSameFormat = unmuteSuccess?.[2] || null;
		fragInfo.dlSuccess = !!events.findLast(nameEq(DL_EVENT.FRAG_DOWNLOAD_SUCCESS));
		fragInfo.dlUnmutedSuccess = !!events.findLast(nameEq(DL_EVENT.FRAG_DOWNLOAD_UNMUTED_SUCCESS));
		fragInfo.replaceAudioSuccess = !!events.findLast(nameEq(DL_EVENT.FRAG_REPLACE_AUDIO_SUCCESS));
	}
	return fragsInfo;
};
const getInitPayload = (log) => log.findLast(nameEq(DL_EVENT.INIT))?.[1] || null;
const showStats = async (logPath) => {
	const log = await getLog(logPath);
	if (!log) {
		console.error("[stats] Cannot read log file");
		return;
	}
	const ffd = log.findLast(nameEq(DL_EVENT.FRAGS_FOR_DOWNLOADING));
	if (!ffd) return;
	const [, fragStartIdx, fragEndIdx] = ffd;
	if (fragStartIdx === 0 && fragEndIdx === 0) return;
	const fragsInfo = getFragsInfo(log);
	let downloaded = 0;
	let muted = 0;
	let unmutedSameFormat = 0;
	let unmutedReplacedAudio = 0;
	for (let i = fragStartIdx; i <= fragEndIdx; i += 1) {
		const fragInfo = fragsInfo[i];
		if (!fragInfo) continue;
		if (fragInfo.dlSuccess) downloaded += 1;
		if (fragInfo.muted) muted += 1;
		if (!fragInfo.unmuteSuccess) continue;
		if (!fragInfo.dlSuccess) continue;
		if (fragInfo.unmuteSameFormat) unmutedSameFormat += 1;
		else if (fragInfo.dlUnmutedSuccess && fragInfo.replaceAudioSuccess) unmutedReplacedAudio += 1;
	}
	const stats = {
		Total: fragEndIdx - fragStartIdx + 1,
		Downloaded: downloaded,
		Muted: muted
	};
	const statsUnmuted = {
		"Unmuted total": unmutedSameFormat + unmutedReplacedAudio,
		"Unmuted (same format)": unmutedSameFormat,
		"Unmuted (replaced audio)": unmutedReplacedAudio
	};
	console.log("[stats] Fragments");
	console.table(muted > 0 ? {
		...stats,
		...statsUnmuted
	} : stats);
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
	const dest = path.parse(destPath);
	const args = [
		"--console-log-level",
		"error",
		"--max-overall-download-limit",
		rateLimit,
		"--dir",
		dest.dir,
		"-o",
		dest.base,
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
//#region src/lib/throttleTransform.ts
var ThrottleTransform = class extends stream.Transform {
	rateBps;
	startTime;
	processedBytes;
	constructor(rateBps) {
		super();
		this.rateBps = rateBps;
		this.startTime = Date.now();
		this.processedBytes = 0;
	}
	_transform(chunk, _, callback) {
		this.processedBytes += chunk.length;
		const expectedTime = this.processedBytes / this.rateBps * 1e3;
		const actualTime = Date.now() - this.startTime;
		const delay = Math.max(0, expectedTime - actualTime);
		if (delay > 0) setTimeout(() => {
			this.push(chunk);
			callback();
		}, delay);
		else {
			this.push(chunk);
			callback();
		}
	}
};

//#endregion
//#region src/downloaders/fetch.ts
const WRONG_LIMIT_RATE_SYNTAX = "Wrong --limit-rate syntax";
const RATE_LIMIT_MULTIPLIER = {
	B: 1,
	K: 1024,
	M: 1024 * 1024
};
const parseRateLimit = (rateLimit) => {
	const m = rateLimit.match(/^(?<value>\d+(?:\.\d+)?)(?<unit>[KM])?$/i);
	if (!m) throw new Error(WRONG_LIMIT_RATE_SYNTAX);
	const { value, unit } = m.groups;
	const v = Number.parseFloat(value);
	const u = unit ? unit.toUpperCase() : "B";
	if (Number.isNaN(v)) throw new Error(WRONG_LIMIT_RATE_SYNTAX);
	const multiplier = RATE_LIMIT_MULTIPLIER[u];
	return Math.round(v * multiplier);
};
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
const downloadFile$1 = async (url, destPath, rateLimit, gzip = true) => {
	const rateLimitN = rateLimit ? parseRateLimit(rateLimit) : null;
	try {
		const res = await fetch(url, { headers: { "Accept-Encoding": gzip ? "deflate, gzip" : "" } });
		if (!res.ok) return RET_CODE.HTTP_RETURNED_ERROR;
		await stream.promises.pipeline(stream.Readable.fromWeb(res.body), rateLimitN ? new ThrottleTransform(rateLimitN) : new stream.PassThrough(), fs.createWriteStream(destPath, { flags: "wx" }));
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
	for (let i = 0; i < retries; i += 1) {
		let retCode = RET_CODE.OK;
		if (downloader === ARIA2C$1) retCode = await downloadFile$3(url, destPath, rateLimit, gzip);
		if (downloader === FETCH$1) retCode = await downloadFile$1(url, destPath, rateLimit, gzip);
		if (retCode === RET_CODE.OK) return retCode;
		await setTimeout$1(1e3);
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
//#region src/lib/isFMp4MediaFile.ts
const isFMp4MediaFile = async (filePath) => {
	const fd = await fsp.open(filePath, "r");
	try {
		const buf = Buffer.alloc(4096);
		await fd.read(buf, 0, buf.length, 0);
		const hasMoof = buf.includes(Buffer.from("moof"));
		const hasMdat = buf.includes(Buffer.from("mdat"));
		return hasMoof && hasMdat;
	} finally {
		await fd.close();
	}
};

//#endregion
//#region src/lib/isMp4File.ts
const isMp4File = async (filePath) => {
	const fd = await fsp.open(filePath, "r");
	try {
		const buf = Buffer.alloc(12);
		await fd.read(buf, 0, buf.length, 0);
		return buf[4] === 102 && buf[5] === 116 && buf[6] === 121 && buf[7] === 112;
	} finally {
		await fd.close();
	}
};

//#endregion
//#region src/lib/isTsFile.ts
const PACKET_SIZE = 188;
const TS_SYNC_BYTE = 71;
const isTsFile = async (filePath, packetsToCheck = 1) => {
	const fd = await fsp.open(filePath, "r");
	try {
		const buf = Buffer.alloc(PACKET_SIZE * packetsToCheck);
		const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
		if (bytesRead < PACKET_SIZE * packetsToCheck) return false;
		for (let i = 0; i < packetsToCheck; i += 1) if (buf[i * PACKET_SIZE] !== TS_SYNC_BYTE) return false;
		return true;
	} finally {
		await fd.close();
	}
};

//#endregion
//#region src/lib/unlinkIfAny.ts
const unlinkIfAny = async (path$1) => {
	try {
		return await fsp.unlink(path$1);
	} catch {}
};

//#endregion
//#region src/utils/downloadFrag.ts
const CHECK_FILE_TYPE = {
	any: () => true,
	ts: isTsFile,
	mp4: isMp4File,
	"fmp4-map": isMp4File,
	"fmp4-media": isFMp4MediaFile
};
const downloadFrag = async (downloader, url, destPath, limitRateArg, gzip, type = "any") => {
	const destPathTmp = `${destPath}.part`;
	if (await statsOrNull(destPathTmp)) await fsp.unlink(destPathTmp);
	const startTime = Date.now();
	const retCode = await downloadFile(downloader, url, destPathTmp, limitRateArg, gzip);
	const endTime = Date.now();
	if (retCode !== RET_CODE.OK) {
		await unlinkIfAny(destPathTmp);
		return null;
	}
	await fsp.rename(destPathTmp, destPath);
	const [{ size }, isTs] = await Promise.all([fsp.stat(destPath), CHECK_FILE_TYPE[type](destPath)]);
	if (!isTs) {
		await fsp.unlink(destPath);
		return null;
	}
	return {
		size,
		time: endTime - startTime
	};
};

//#endregion
//#region src/utils/getDlFormat.ts
const getDlFormat = (formats, formatArg) => {
	const dlFormat = formatArg === "best" ? formats[0] : formats.find((f) => f.format_id.toLowerCase() === formatArg.toLowerCase());
	if (!dlFormat) throw new Error("Wrong format");
	return dlFormat;
};

//#endregion
//#region src/utils/getExistingFrags.ts
const getExistingFrags = (frags, outputPath, dir) => {
	const existingFrags = frags.filter((frag) => dir.includes(path.parse(getPath.frag(outputPath, frag.idx + 1)).base));
	existingFrags.isFMp4 = frags.isFMp4;
	return existingFrags;
};

//#endregion
//#region src/utils/getFragsForDownloading.ts
const getFragsForDownloading = (playlistUrl, playlist, args) => {
	const baseUrl = playlistUrl.split("/").slice(0, -1).join("/");
	let frags = [];
	let offset = 0;
	let idx = 0;
	const mapFragUri = playlist.segments[0]?.map?.uri;
	let mapFrag = null;
	if (mapFragUri) {
		const url = `${baseUrl}/${mapFragUri}`;
		mapFrag = {
			idx,
			offset,
			duration: 0,
			isMap: true,
			url
		};
		idx += 1;
	}
	for (const { duration, uri } of playlist.segments) {
		const url = `${baseUrl}/${uri}`;
		frags.push({
			idx,
			offset,
			duration,
			url
		});
		offset += duration;
		idx += 1;
	}
	if (args["download-sections"]) {
		const [startTime, endTime] = args["download-sections"];
		const firstFragIdx = frags.findLastIndex((frag) => frag.offset <= startTime);
		const lastFragIdx = endTime === Infinity ? frags.length - 1 : frags.findIndex((frag) => frag.offset >= endTime);
		frags = frags.slice(firstFragIdx, lastFragIdx + 1);
	}
	if (mapFrag) frags = [mapFrag, ...frags];
	const dlFrags = frags;
	dlFrags.isFMp4 = !!mapFrag;
	return dlFrags;
};

//#endregion
//#region src/utils/getTryUnmute.ts
const ONE_WEEK_MS = 10080 * 60 * 1e3;
const getTryUnmute = (videoInfo) => {
	const videoDate = videoInfo.upload_date || videoInfo.release_date;
	if (!videoDate) return null;
	const videoDateMs = new Date(videoDate).getTime();
	return Date.now() - videoDateMs < ONE_WEEK_MS;
};

//#endregion
//#region src/utils/getUnmutedFrag.ts
const LOWER_AUDIO_QUALITY = ["160p30", "360p30"];
const SAME_FORMAT_SLUGS = ["audio_only", ...LOWER_AUDIO_QUALITY];
const getFormatSlug = (url) => url.split("/").at(-2);
const getFragResponse = ([available, availableGzip], sameFormat, url) => {
	if (available) return {
		sameFormat,
		gzip: false,
		url
	};
	if (availableGzip) return {
		sameFormat,
		gzip: true,
		url
	};
	return null;
};
const getUnmutedFrag = async (downloader, unmuteArg, fragUrl, formats) => {
	if (unmuteArg === UNMUTE.OFF) return null;
	const currentFormatSlug = getFormatSlug(fragUrl);
	if (unmuteArg === UNMUTE.ANY && currentFormatSlug === "audio_only") {
		console.warn("[unmute] Unmuting audio_only format is not supported");
		unmuteArg = UNMUTE.SAME_FORMAT;
	}
	if (!unmuteArg) unmuteArg = SAME_FORMAT_SLUGS.includes(currentFormatSlug) ? UNMUTE.SAME_FORMAT : UNMUTE.QUALITY;
	if (unmuteArg === UNMUTE.SAME_FORMAT) {
		const url = fragUrl.replace("-muted", "");
		const [availability] = await isUrlsAvailable(downloader, [url]);
		return getFragResponse(availability, true, url);
	}
	if (unmuteArg === UNMUTE.ANY || unmuteArg === UNMUTE.QUALITY) {
		const urls = [];
		let currentFormatIdx = -1;
		for (let i = 0; i < formats.length; i += 1) {
			const formatSlug = getFormatSlug(formats[i].url);
			if (unmuteArg === UNMUTE.QUALITY && LOWER_AUDIO_QUALITY.includes(formatSlug)) continue;
			if (formatSlug === currentFormatSlug) currentFormatIdx = i;
			urls.push(fragUrl.replace("-muted", "").replace(`/${currentFormatSlug}/`, `/${formatSlug}/`));
		}
		const responses = await isUrlsAvailable(downloader, urls);
		const unmutedSameFormat = getFragResponse(responses[currentFormatIdx], true, urls[currentFormatIdx]);
		if (unmutedSameFormat) return unmutedSameFormat;
		const idx = responses.findLastIndex(([av, avGzip]) => av || avGzip);
		if (idx === -1) return null;
		return getFragResponse(responses[idx], false, urls[idx]);
	}
	throw new Error();
};

//#endregion
//#region src/utils/processUnmutedFrags.ts
const processUnmutedFrags = async (frags, outputPath, dir, writeLog) => {
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
			await unlinkIfAny(fragUnmutedPathTmp);
			console.error(`${message}. Failure`);
			writeLog?.([DL_EVENT.FRAG_REPLACE_AUDIO_FAILURE, frag.idx]);
			continue;
		}
		await Promise.all([fsp.unlink(fragPath), fsp.unlink(fragUnmutedPath)]);
		await fsp.rename(fragUnmutedPathTmp, fragPath);
		console.log(`${message}. Success`);
		writeLog?.([DL_EVENT.FRAG_REPLACE_AUDIO_SUCCESS, frag.idx]);
	}
};

//#endregion
//#region src/utils/readOutputDir.ts
const readOutputDir = (outputPath) => fsp.readdir(path.parse(outputPath).dir || ".");

//#endregion
//#region src/utils/showFormats.ts
const showFormats = (formats) => {
	console.table([...formats].reverse().map(({ format_id, width, height, frameRate, totalBitrate, source }) => {
		const fmt = {};
		fmt.format_id = format_id;
		fmt.resolution = "unknown";
		if (format_id === "Audio_Only") fmt.resolution = "audio only";
		else if (width && height) fmt.resolution = `${width}x${height}`;
		else if (height) fmt.resolution = `${height}p`;
		fmt.fps = frameRate;
		if (totalBitrate) fmt.total_bitrate = `${(totalBitrate / 1024).toFixed()}k`;
		fmt.source = source;
		return fmt;
	}));
};

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
const percentFmt = new Intl.NumberFormat(LOCALE, {
	style: "percent",
	minimumFractionDigits: 1,
	maximumFractionDigits: 1
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, {
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
	const dlFrags = Array.from(downloadedFrags.values());
	const dlSize = dlFrags.reduce((acc, f) => acc + f.size, 0);
	const avgFragSize = dlFrags.length ? dlSize / dlFrags.length : 0;
	const last5 = dlFrags.filter((f) => f.time !== 0).slice(-5);
	const currentSpeedBps = last5.length ? last5.map((f) => f.size / f.time * 1e3).reduce((a, b) => a + b, 0) / last5.length : 0;
	const estFullSize = avgFragSize * fragsCount;
	const estSizeLeft = estFullSize - dlSize;
	let estTimeLeftSec = currentSpeedBps ? estSizeLeft / currentSpeedBps : 0;
	let downloadedPercent = estFullSize ? dlSize / estFullSize : 0;
	downloadedPercent = Math.min(100, downloadedPercent) || 0;
	if (estTimeLeftSec < 0) estTimeLeftSec = 0;
	const progress = [
		"[download] ",
		chalk.cyan(percentFmt.format(downloadedPercent).padStart(6, " ")),
		" of ~ ",
		formatSize(estFullSize || 0).padStart(9, " "),
		" at ",
		chalk.green(formatSpeed(currentSpeedBps || 0).padStart(11, " ")),
		" ETA ",
		chalk.yellow(timeFmt.format(estTimeLeftSec * 1e3)),
		` (frag ${dlFrags.length}/${fragsCount})\r`
	].join("");
	process.stdout.write(progress);
};

//#endregion
//#region src/utils/downloadVideo.ts
const WAIT_BETWEEN_CYCLES_SEC = 60;
const RETRY_MESSAGE = `Retry every ${WAIT_BETWEEN_CYCLES_SEC} second(s)`;
const downloadVideo = async (formats, videoInfo, args) => {
	if (args["list-formats"]) {
		showFormats(formats);
		process.exit();
	}
	if (!await isInstalled("ffmpeg")) throw new Error("ffmpeg is not installed. Install it from https://ffmpeg.org/");
	const dlFormat = getDlFormat(formats, args.format);
	const outputPath = getPath.output(args.output || DEFAULT_OUTPUT_TEMPLATE, videoInfo);
	let frags;
	let fragsCount = 0;
	let playlistUrl = dlFormat.url;
	const downloadedFrags = /* @__PURE__ */ new Map();
	const logPath = getPath.log(outputPath);
	const writeLog = createLogger(logPath);
	const tryUnmute = getTryUnmute(videoInfo);
	if (tryUnmute === false) console.warn(NO_TRY_UNMUTE_MESSAGE);
	writeLog([DL_EVENT.INIT, {
		args,
		formats,
		outputPath,
		playlistUrl,
		videoInfo
	}]);
	while (true) {
		let playlistContent = await fetchText(playlistUrl, "playlist");
		if (!playlistContent) {
			writeLog([DL_EVENT.FETCH_PLAYLIST_FAILURE]);
			const newPlaylistUrl = dlFormat.url.replace(/-muted-\w+(?=\.m3u8$)/, "");
			if (newPlaylistUrl !== playlistUrl) {
				playlistContent = await fetchText(playlistUrl, "playlist (attempt #2)");
				if (playlistContent) {
					playlistUrl = newPlaylistUrl;
					writeLog([DL_EVENT.FETCH_PLAYLIST_OLD_MUTED_SUCCESS, playlistUrl]);
				} else writeLog([DL_EVENT.FETCH_PLAYLIST_OLD_MUTED_FAILURE]);
			}
		}
		if (!playlistContent && !args["live-from-start"]) throw new Error("Cannot download the playlist");
		if (!playlistContent) {
			console.warn(`[live-from-start] Waiting for the playlist. ${RETRY_MESSAGE}`);
			await setTimeout$1(WAIT_BETWEEN_CYCLES_SEC * 1e3);
			continue;
		}
		const playlist = parse(playlistContent);
		writeLog([DL_EVENT.FETCH_PLAYLIST_SUCCESS]);
		frags = getFragsForDownloading(playlistUrl, playlist, args);
		writeLog(logFragsForDownloading(frags));
		await fsp.writeFile(getPath.playlist(outputPath), playlistContent);
		if (args["download-sections"] && downloadedFrags.size === frags.length) break;
		const hasNewFrags = frags.length > fragsCount;
		fragsCount = frags.length;
		if (!hasNewFrags && !playlist.endlist) {
			const message = `[live-from-start] ${chalk.green("VOD ONLINE")}: waiting for new fragments`;
			console.log(`${message}. ${RETRY_MESSAGE}`);
			await setTimeout$1(WAIT_BETWEEN_CYCLES_SEC * 1e3);
			continue;
		}
		for (const [i, frag] of frags.entries()) {
			showProgress(downloadedFrags, fragsCount);
			const fragPath = getPath.frag(outputPath, frag.idx + 1);
			const fragStats = await statsOrNull(fragPath);
			if (fragStats) {
				if (!downloadedFrags.has(i)) {
					downloadedFrags.set(i, {
						size: fragStats.size,
						time: 0
					});
					showProgress(downloadedFrags, fragsCount);
				}
				continue;
			}
			if (frag.url.includes("-unmuted")) {
				writeLog([DL_EVENT.FRAG_RENAME_UNMUTED, frag.idx]);
				frag.url = frag.url.replace("-unmuted", "-muted");
			}
			let unmutedFrag = null;
			if (frag.url.includes("-muted")) {
				writeLog([DL_EVENT.FRAG_MUTED, frag.idx]);
				if (tryUnmute) {
					unmutedFrag = await getUnmutedFrag(args.downloader, args.unmute, frag.url, formats);
					writeLog(logUnmuteResult(unmutedFrag, frag.idx));
				}
			}
			let fragGzip = void 0;
			if (unmutedFrag && unmutedFrag.sameFormat) {
				frag.url = unmutedFrag.url;
				fragGzip = unmutedFrag.gzip;
			}
			let fragMeta = await downloadFrag(args.downloader, frag.url, fragPath, args["limit-rate"], fragGzip, frags.isFMp4 ? frag.isMap ? "fmp4-map" : "fmp4-media" : "ts");
			downloadedFrags.set(i, fragMeta || {
				size: 0,
				time: 0
			});
			writeLog([fragMeta ? DL_EVENT.FRAG_DOWNLOAD_SUCCESS : DL_EVENT.FRAG_DOWNLOAD_FAILURE, frag.idx]);
			if (unmutedFrag && !unmutedFrag.sameFormat) {
				fragMeta = await downloadFrag(args.downloader, unmutedFrag.url, getPath.fragUnmuted(fragPath), args["limit-rate"], unmutedFrag.gzip, frags.isFMp4 ? "fmp4-media" : "ts");
				writeLog([fragMeta ? DL_EVENT.FRAG_DOWNLOAD_UNMUTED_SUCCESS : DL_EVENT.FRAG_DOWNLOAD_UNMUTED_FAILURE, frag.idx]);
			}
			showProgress(downloadedFrags, fragsCount);
		}
		process.stdout.write("\n");
		if (playlist.endlist) break;
	}
	const dir = await readOutputDir(outputPath);
	const existingFrags = getExistingFrags(frags, outputPath, dir);
	writeLog([DL_EVENT.FRAGS_EXISTING, existingFrags.length]);
	await processUnmutedFrags(existingFrags, outputPath, dir, writeLog);
	const retCode = await mergeFrags(args["merge-method"], existingFrags, outputPath, args["keep-fragments"]);
	writeLog([retCode ? DL_EVENT.MERGE_FRAGS_FAILURE : DL_EVENT.MERGE_FRAGS_SUCCESS]);
	await showStats(logPath);
	if (!args["keep-fragments"]) await fsp.unlink(logPath);
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
	upload_date: (/* @__PURE__ */ new Date(startTimestamp * 1e3)).toISOString(),
	release_date: (/* @__PURE__ */ new Date(startTimestamp * 1e3)).toISOString(),
	view_count: null,
	ext: "mp4"
});
const getVideoInfoByClipMeta = (clipMeta) => ({
	id: clipMeta.slug,
	title: clipMeta.title,
	description: null,
	duration: clipMeta.durationSeconds,
	uploader: clipMeta.broadcaster?.displayName || clipMeta.broadcaster?.login || null,
	uploader_id: clipMeta.broadcaster?.id || null,
	upload_date: clipMeta.createdAt,
	release_date: clipMeta.createdAt,
	view_count: clipMeta.viewCount,
	ext: "mp4"
});

//#endregion
//#region src/utils/downloadWithStreamlink.ts
const DEFAULT_STREAMLINK_ARGS = ["--twitch-force-client-integrity", "--twitch-access-token-param=playerType=frontpage"];
const getDefaultOutputTemplate = () => {
	const now = (/* @__PURE__ */ new Date()).toISOString().slice(0, 16).replace("T", " ").replace(":", "_");
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
//#region src/utils/parseDownloadFormats.ts
const parseDownloadFormats = (playlistContent) => {
	let formats = [];
	const playlist = parse(playlistContent);
	for (let i = 0; i < playlist.variants.length; i += 1) {
		const { uri, resolution, video, frameRate, bandwidth } = playlist.variants[i];
		const { name } = video[0];
		formats.push({
			format_id: name.replaceAll(" ", "_"),
			width: resolution?.width || null,
			height: resolution?.height || null,
			frameRate: frameRate ? Math.round(frameRate) : null,
			totalBitrate: bandwidth || null,
			source: i === 0 ? true : null,
			url: uri
		});
	}
	for (const sessionData of playlist.sessionDataList) {
		if (sessionData.id !== "com.amazon.ivs.unavailable-media") continue;
		if (!sessionData.value) continue;
		let unavailableMedia = [];
		try {
			unavailableMedia = JSON.parse(atob(sessionData.value));
		} catch (e) {
			console.warn(`${chalk.yellow("WARN:")} Failed to parse unavailable media: ${e.message}`);
		}
		if (unavailableMedia.length > 0) formats.forEach((f) => f.source = null);
		for (const media of unavailableMedia) {
			const [width, height] = media.RESOLUTION ? media.RESOLUTION.split("x").map((v) => Number.parseInt(v)) : [null, null];
			let urlArr = formats[0].url.split("/");
			urlArr = urlArr.with(-2, media["GROUP-ID"]);
			const url = urlArr.join("/");
			formats.push({
				format_id: media.NAME.replaceAll(" ", "_"),
				width,
				height,
				frameRate: media["FRAME-RATE"] ? Math.round(media["FRAME-RATE"]) : null,
				totalBitrate: media.BANDWIDTH || null,
				source: media["GROUP-ID"] === "chunked" || null,
				url
			});
		}
		if (formats.every((f) => !f.source)) {
			const last = formats.findLast((f) => f.format_id !== "Audio_Only");
			if (last) last.source = true;
		}
	}
	formats.sort((a, b) => (b.height || 0) - (a.height || 0));
	const counts = {};
	for (const { format_id } of formats) counts[format_id] = (counts[format_id] || 0) + 1;
	const remaining = { ...counts };
	formats = formats.map((format) => {
		const { format_id } = format;
		if (counts[format_id] > 1) {
			const suffix = remaining[format_id] - 1;
			remaining[format_id] -= 1;
			format.format_id = `${format_id}-${suffix}`;
		}
		return format;
	});
	return formats;
};

//#endregion
//#region src/utils/getVideoFormats.ts
const FORMATS = [
	"chunked",
	"1440p60",
	"1440p30",
	"1080p60",
	"1080p30",
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
		let height = null;
		let frameRate = null;
		const m = format.match(/^(?<height>\d+)p(?<frameRate>\d+)$/);
		if (m) {
			const groups = m.groups;
			height = Number.parseInt(groups.height);
			frameRate = Number.parseInt(groups.frameRate);
		}
		formats.push({
			format_id: FORMATS_MAP[format] || format,
			height,
			frameRate,
			source: format === "chunked" ? true : null,
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
		videoInfo
	};
};

//#endregion
//#region src/commands/downloadByChannelLogin.ts
const downloadByChannelLogin = async (channelLogin, args) => {
	const delay = args["retry-streams"] || 0;
	const isLiveFromStart = args["live-from-start"];
	const isRetry = delay > 0;
	while (true) {
		const streamMeta = await getStreamMetadata(channelLogin);
		const isLive = !!streamMeta?.stream;
		if (!isLive) if (isRetry) console.log(`[retry-streams] Waiting for streams. Retry every ${delay} second(s)`);
		else {
			console.warn("[download] The channel is not currently live");
			return;
		}
		if (isLive && !isLiveFromStart) await downloadWithStreamlink(`https://www.twitch.tv/${channelLogin}`, streamMeta, channelLogin, args);
		if (isLive && isLiveFromStart) {
			const liveVideoInfo = await getLiveVideoInfo(streamMeta, channelLogin);
			if (liveVideoInfo) {
				const { formats, videoInfo } = liveVideoInfo;
				await downloadVideo(formats, videoInfo, args);
				if (!isRetry || args["download-sections"]) return;
			} else {
				let message = `[live-from-start] Cannot find the playlist`;
				if (isRetry) {
					message += `. Retry every ${delay} second(s)`;
					console.warn(message);
				} else {
					console.warn(message);
					return;
				}
			}
		}
		await setTimeout$1(delay * 1e3);
	}
};

//#endregion
//#region src/commands/downloadByVideoId.ts
const downloadByVideoId = async (videoId, args) => {
	let [formats, videoMeta] = await Promise.all([getVideoFormats(videoId), getVideoMetadata(videoId)]);
	if (formats.length === 0 && videoMeta !== null) {
		console.log("Trying to get playlist from video metadata");
		formats = await getVideoFormatsByThumbUrl(videoMeta.broadcastType, videoMeta.id, videoMeta.previewThumbnailURL);
	}
	if (formats.length === 0 || !videoMeta) return console.log(PRIVATE_VIDEO_INSTRUCTIONS);
	const videoInfo = getVideoInfoByVideoMeta(videoMeta);
	return downloadVideo(formats, videoInfo, args);
};

//#endregion
//#region src/commands/downloadByVodPath.ts
const downloadByVodPath = async (parsedLink, args) => {
	const formats = await getVideoFormatsByFullVodPath(getFullVodPath(parsedLink.vodPath));
	const videoInfo = getVideoInfoByVodPath(parsedLink);
	return downloadVideo(formats, videoInfo, args);
};

//#endregion
//#region src/commands/downloadClip.ts
const getClipFormats = (clipMeta) => {
	const formats = [];
	const { signature: sig, value: token } = clipMeta.playbackAccessToken;
	const addFormats = (videoQualities, formatIdPrefix = "") => {
		for (let i = 0; i < videoQualities.length; i += 1) {
			const { quality, frameRate, sourceURL } = videoQualities[i];
			if (!sourceURL) continue;
			formats.push({
				format_id: `${formatIdPrefix}${quality}`,
				height: Number.parseInt(quality) || null,
				frameRate: frameRate ? Math.round(frameRate) : null,
				source: null,
				url: `${sourceURL}?sig=${sig}&token=${encodeURIComponent(token)}`
			});
		}
	};
	const [assetDefault, assetPortrait] = clipMeta.assets;
	addFormats(assetDefault?.videoQualities || []);
	addFormats(assetPortrait?.videoQualities || [], "portrait-");
	formats[0].source = true;
	return formats;
};
const downloadClip = async (slug, args) => {
	const clipMeta = await getClipMetadata(slug);
	if (!clipMeta) throw new Error("Clip not found");
	const formats = getClipFormats(clipMeta);
	if (args["list-formats"]) return showFormats(formats);
	const dlFormat = getDlFormat(formats, args.format);
	const destPath = getPath.output(args.output || DEFAULT_OUTPUT_TEMPLATE, getVideoInfoByClipMeta(clipMeta));
	console.log(`[download] Destination: ${destPath}`);
	if (await statsOrNull(destPath)) {
		console.warn(`[download] File already exists, skipping`);
		return;
	}
	const res = await fetch(dlFormat.url, { method: "HEAD" });
	const size = Number.parseInt(res.headers.get("content-length") || "0");
	console.log(`[download] Downloading clip (${(size / 1024 / 1024).toFixed(2)} MB)`);
	const result = await downloadFrag(args.downloader, dlFormat.url, destPath, args["limit-rate"], void 0, "mp4");
	if (!result) throw new Error("[download] Download failed");
	console.log("[download] Done");
};

//#endregion
//#region src/commands/mergeFragments.ts
const tryUnmuteFrags = async (outputPath, log, frags, formats, args, writeLog) => {
	const fragsInfo = getFragsInfo(log);
	for (const frag of frags) {
		const fragN = frag.idx + 1;
		const info = fragsInfo[frag.idx];
		if (!info || !info.muted || info.replaceAudioSuccess) continue;
		if (info.unmuteSameFormat && info.dlSuccess) continue;
		const unmutedFrag = await getUnmutedFrag(args.downloader, args.unmute, frag.url, formats);
		writeLog(logUnmuteResult(unmutedFrag, frag.idx));
		if (!unmutedFrag) {
			console.log(`[unmute] Frag${fragN}: cannot unmute`);
			continue;
		}
		const fragPath = getPath.frag(outputPath, fragN);
		if (unmutedFrag.sameFormat) {
			const fragPathTmp = `${fragPath}.tmp`;
			await fsp.rename(fragPath, fragPathTmp);
			const fragMeta = await downloadFrag(args.downloader, unmutedFrag.url, fragPath, args["limit-rate"], unmutedFrag.gzip, frags.isFMp4 ? "fmp4-media" : "ts");
			if (fragMeta) {
				await fsp.unlink(fragPathTmp);
				console.log(`[unmute] Frag${fragN}: successfully unmuted`);
			} else {
				await fsp.rename(fragPathTmp, fragPath);
				console.log(`[unmute] Frag${fragN}: cannot download unmuted fragment`);
			}
			writeLog([fragMeta ? DL_EVENT.FRAG_DOWNLOAD_SUCCESS : DL_EVENT.FRAG_DOWNLOAD_FAILURE, frag.idx]);
		} else {
			const unmutedFragPath = getPath.fragUnmuted(fragPath);
			const fragMeta = await downloadFrag(args.downloader, unmutedFrag.url, unmutedFragPath, args["limit-rate"], unmutedFrag.gzip, frags.isFMp4 ? "fmp4-media" : "ts");
			if (fragMeta) console.log(`[unmute] Frag${fragN}: successfully unmuted`);
			else console.log(`[unmute] Frag${fragN}: cannot download unmuted fragment`);
			writeLog([fragMeta ? DL_EVENT.FRAG_DOWNLOAD_UNMUTED_SUCCESS : DL_EVENT.FRAG_DOWNLOAD_UNMUTED_FAILURE, frag.idx]);
		}
	}
};
const mergeFragments = async (outputPath, args) => {
	outputPath = path.resolve(outputPath);
	const [playlistContent, dir] = await Promise.all([fsp.readFile(getPath.playlist(outputPath), "utf8"), readOutputDir(outputPath)]);
	const logPath = getPath.log(outputPath);
	const log = await getLog(logPath);
	const writeLog = createLogger(logPath);
	const dlInfo = getInitPayload(log || []);
	const playlistUrl = dlInfo?.playlistUrl || "";
	const playlist = parse(playlistContent);
	const allFrags = getFragsForDownloading(playlistUrl, playlist, args);
	const frags = getExistingFrags(allFrags, outputPath, dir);
	if (log && dlInfo && args.unmute && args.unmute !== UNMUTE.OFF) {
		const { videoInfo, formats } = dlInfo;
		if (getTryUnmute(videoInfo)) await tryUnmuteFrags(outputPath, log, frags, formats, args, writeLog);
		else console.warn(NO_TRY_UNMUTE_MESSAGE);
	}
	writeLog(logFragsForDownloading(frags));
	await processUnmutedFrags(frags, outputPath, dir, writeLog);
	await mergeFrags(args["merge-method"], frags, outputPath, true);
	await showStats(logPath);
};

//#endregion
//#region src/commands/showHelp.ts
const showHelp = async () => {
	const readmePath = path.resolve(import.meta.dirname, "README.md");
	const readme = await fsp.readFile(readmePath, "utf8");
	const entries = readme.split(/\s## (.*)/g).slice(1);
	const sections = {};
	for (let i = 0; i < entries.length; i += 2) {
		const header = entries[i];
		const content = entries[i + 1].trim();
		sections[header] = content;
	}
	const help = [
		"Options:",
		sections.Options.replace(/^```\w+\n(.*)\n```$/s, "$1"),
		"",
		"Dependencies:",
		sections.Dependencies.replaceAll("**", "")
	];
	console.log(help.join("\n"));
};

//#endregion
//#region src/commands/showVersion.ts
const showVersion = async () => {
	const pkgPath = path.resolve(import.meta.dirname, "package.json");
	const pkg = await fsp.readFile(pkgPath, "utf8");
	console.log(JSON.parse(pkg).version);
};

//#endregion
//#region src/utils/args/getDownloader.ts
const [ARIA2C, CURL, FETCH] = DOWNLOADERS;
const getDownloader = async (downloaderArg) => {
	if (downloaderArg === FETCH) return FETCH;
	if (downloaderArg === ARIA2C) {
		if (await isInstalled(ARIA2C)) return ARIA2C;
		throw new Error(`${ARIA2C} is not installed. Install it from https://aria2.github.io/`);
	}
	if (downloaderArg === CURL) {
		if (await isInstalled(CURL)) return CURL;
		const curlLink = os.platform() === "win32" ? "https://curl.se/windows/" : "https://curl.se/download.html";
		throw new Error(`${CURL} is not installed. Install it from ${curlLink}`);
	}
	throw new Error(`Unknown downloader: ${downloaderArg}. Available: ${DOWNLOADERS.join(", ")}`);
};

//#endregion
//#region src/utils/args/parseDownloadSectionsArg.ts
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
	return [startTime, endTime];
};

//#endregion
//#region src/utils/args/normalizeArgs.ts
const normalizeArgs = async (args) => {
	const newArgs = { ...args };
	newArgs.downloader = await getDownloader(args.downloader);
	newArgs["download-sections"] = parseDownloadSectionsArg(args["download-sections"]);
	if (args["retry-streams"]) {
		const delay = Number.parseInt(args["retry-streams"]);
		if (!delay) throw new Error("Wrong --retry-streams delay");
		if (delay < 10) throw new Error("Min --retry-streams delay is 10");
		newArgs["retry-streams"] = delay;
	}
	if (!MERGE_METHODS.includes(args["merge-method"])) throw new Error(`Unknown merge method: ${args["merge-method"]}. Available: ${MERGE_METHODS.join(", ")}`);
	const unmuteValues = Object.values(UNMUTE);
	if (args["unmute"] && !unmuteValues.includes(args["unmute"])) throw new Error(`Unknown unmute policy: ${args["unmute"]}. Available: ${unmuteValues.join(", ")}`);
	return newArgs;
};

//#endregion
//#region node_modules/.pnpm/twitch-regex@0.1.3/node_modules/twitch-regex/dist/index.js
var CLIP_REGEX_STRING = "https?:\\/\\/(?:clips\\.twitch\\.tv\\/(?:embed\\?.*?\\bclip=|\\/*)|(?:(?:www|go|m)\\.)?twitch\\.tv\\/(?:(?<channel>[^/]+)\\/)?clip\\/)(?<slug>[\\w-]+)\\S*";
var CLIP_REGEX_EXACT = /* @__PURE__ */ new RegExp(`^${CLIP_REGEX_STRING}$`);
var VIDEO_REGEX_STRING = "https?:\\/\\/(?:(?:(?:www|go|m)\\.)?twitch\\.tv\\/(?:videos|(?<channel>[^/]+)\\/v(?:ideo)?)\\/|player\\.twitch\\.tv\\/\\?.*?\\bvideo=v?|www\\.twitch\\.tv\\/(?:[^/]+)\\/schedule\\?vodID=)(?<id>\\d+)\\S*";
var VIDEO_REGEX_EXACT = /* @__PURE__ */ new RegExp(`^${VIDEO_REGEX_STRING}$`);
var CHANNEL_REGEX_STRING = "https?:\\/\\/(?:(?:(?:www|go|m)\\.)?twitch\\.tv\\/|player\\.twitch\\.tv\\/\\?.*?\\bchannel=)(?<channel>\\w+)[^\\s/]*";
var CHANNEL_REGEX_EXACT = /* @__PURE__ */ new RegExp(`^${CHANNEL_REGEX_STRING}$`);
var COLLECTION_REGEX_STRING = "https?:\\/\\/(?:(?:(?:www|go|m)\\.)?twitch\\.tv\\/collections\\/|player\\.twitch\\.tv\\/\\?.*?\\bcollection=)(?<id>[\\w-]+)\\S*";
var COLLECTION_REGEX_EXACT = /* @__PURE__ */ new RegExp(`^${COLLECTION_REGEX_STRING}$`);

//#endregion
//#region src/utils/args/parseLink.ts
const VOD_PATH_REGEX = /^video:(?<vodPath>(?<channelLogin>\w+)_(?<videoId>\d+)_(?<startTimestamp>\d+))$/;
const parseLink = (link) => {
	let m = link.match(VOD_PATH_REGEX);
	if (m) return {
		type: "vodPath",
		...m.groups
	};
	m = link.match(VIDEO_REGEX_EXACT);
	if (m) {
		const { id } = m.groups;
		return {
			type: "video",
			videoId: id
		};
	}
	m = link.match(CLIP_REGEX_EXACT);
	if (m) {
		const { slug } = m.groups;
		return {
			type: "clip",
			slug
		};
	}
	m = link.match(CHANNEL_REGEX_EXACT);
	if (m) {
		const { channel } = m.groups;
		return {
			type: "channel",
			channelLogin: channel.toLowerCase()
		};
	}
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
			short: "F"
		},
		output: {
			type: "string",
			short: "o"
		},
		downloader: {
			type: "string",
			default: "fetch"
		},
		proxy: { type: "string" },
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
	const args = await normalizeArgs(parsedArgs.values);
	const positionals = parsedArgs.positionals;
	if (args.version) return showVersion();
	if (args.help || positionals.length === 0) return showHelp();
	if (args.proxy) {
		process.env.NODE_USE_ENV_PROXY = "1";
		process.env.HTTP_PROXY = args.proxy;
		process.env.HTTPS_PROXY = args.proxy;
	}
	if (positionals.length !== 1) throw new Error("Expected exactly one positional argument");
	if (args["merge-fragments"]) return mergeFragments(positionals[0], args);
	const link = parseLink(positionals[0]);
	if (link.type === "vodPath") return downloadByVodPath(link, args);
	if (link.type === "video") return downloadByVideoId(link.videoId, args);
	if (link.type === "clip") return downloadClip(link.slug, args);
	return downloadByChannelLogin(link.channelLogin, args);
};
main().catch((e) => console.error(chalk.red("ERROR:"), e.message));

//#endregion
export { getArgs };