#!/usr/bin/env node
import fsp from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { setTimeout } from "node:timers/promises";
import crypto from "node:crypto";
import childProcess from "node:child_process";
import fs from "node:fs";
import stream from "node:stream";

//#region src/constants.ts
const HELP = `
Download any twitch VODs from start during live broadcast

GitHub Repo: https://github.com/DmitryScaletta/twitch-dlp

Usage:
npx twitch-dlp LINK

Positional arguments:
LINK                        Link to the VOD or channel

Options:
-h, --help                  Show this help message and exit
-f, --format FORMAT         Select format to download
                            Available formats:
                            - best: best quality (default)
                            - FORMAT: select format by format_id
-F, --list-formats          List available formats and exit
-o, --output OUTPUT         Output filename template
                            Available template variables:
                            - %(title)s
                            - %(id)s
                            - %(ext)s
                            - %(description)s
                            - %(duration)s
                            - %(uploader)s
                            - %(uploader_id)s
                            - %(upload_date)s
                            - %(release_date)s
                            - %(view_count)s
--live-from-start           Download live streams from the start
--retry-streams DELAY       Retry fetching the list of available
                            streams until streams are found
                            while waiting DELAY second(s)
                            between each attempt
-r, --limit-rate RATE       Limit download rate to RATE
--keep-fragments            Keep fragments after downloading
--download-sections TEXT    Download specific part of the video.
                            Syntax: "*start_time-end_time".
                            Examples: "*0-12:34", "*3:14:15-inf"
                            A "*" prefix is for yt-dlp compatibility.
                            Negative timestamps and multiple
                            sections are not supported
--merge-fragments           Merge already downloaded fragments.
                            Example: "npx twitch-dlp FILENAME
                            --merge-fragments". FILENAME must match
                            the fragment names but without
                            ".part-FragN". Can't be used with other
                            options (except --download-sections)

It's also possible to pass streamlink twitch plugin args:
--twitch-disable-ads, --twitch-low-latency, --twitch-api-header,
--twitch-access-token-param, --twitch-force-client-integrity,
--twitch-purge-client-integrity
See https://streamlink.github.io/cli.html#twitch

Requires:
- ffmpeg
- curl (if using --limit-rate option)
- streamlink (if downloading by channel link without --live-from-start)
`;
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

//#endregion
//#region node_modules/.pnpm/twitch-gql-queries@0.1.10/node_modules/twitch-gql-queries/dist/index.js
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
//#region src/lib/spawn.ts
const spawn = (command, args, silent = false) => new Promise((resolve, reject) => {
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
	playlist: (filePath) => `${filePath}-playlist.txt`,
	frag: (filePath, i) => `${filePath}.part-Frag${i}`
};

//#endregion
//#region src/utils/mergeFrags.ts
const runFfconcat = (ffconcatFilename, outputFilename) => spawn("ffmpeg", [
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
const mergeFrags = async (frags, outputPath, keepFragments) => {
	const fragFiles = frags.map((frag) => [getPath.frag(outputPath, frag.idx + 1), frag.duration]);
	const ffconcat = generateFfconcat(fragFiles);
	const ffconcatPath = getPath.ffconcat(outputPath);
	await fsp.writeFile(ffconcatPath, ffconcat);
	const returnCode = await runFfconcat(ffconcatPath, outputPath);
	fsp.unlink(ffconcatPath);
	if (keepFragments || returnCode) return;
	await Promise.all([...fragFiles.map(([filename]) => fsp.unlink(filename)), fsp.unlink(getPath.playlist(outputPath))]);
};

//#endregion
//#region src/utils/showProgress.ts
const COLOR = {
	reset: "\x1B[0m",
	green: "\x1B[32m",
	yellow: "\x1B[33m",
	cyan: "\x1B[36m"
};
const showProgress = (frags, fragsMetadata, currentFragIdx) => {
	const fragsFullSize = fragsMetadata.reduce((acc, f) => acc + f.size, 0);
	const avgFragSize = fragsFullSize / fragsMetadata.length;
	const last5frags = fragsMetadata.slice(-5);
	const currentSpeedBps = last5frags.map((f) => f.size / f.time * 1e3).reduce((a, b) => a + b, 0) / last5frags.length;
	const estFullSize = avgFragSize * frags.length;
	const estDownloadedSize = avgFragSize * (currentFragIdx + 1);
	const estSizeLeft = estFullSize - estDownloadedSize;
	let estTimeLeftSec = estSizeLeft / currentSpeedBps;
	let downloadedPercent = estDownloadedSize / estFullSize;
	if (estTimeLeftSec < 0 || Number.isNaN(estTimeLeftSec)) estTimeLeftSec = 0;
	if (downloadedPercent > 1) downloadedPercent = 1;
	const getValueAndUnit = (n) => {
		const units = [
			"byte",
			"kilobyte",
			"megabyte",
			"gigabyte",
			"terabyte"
		];
		const i = n == 0 ? 0 : Math.floor(Math.log(n) / Math.log(1024));
		const value = n / Math.pow(1024, i);
		return {
			value,
			unit: units[i]
		};
	};
	const estSize = getValueAndUnit(estFullSize || 0);
	const currentSpeed = getValueAndUnit(currentSpeedBps || 0);
	const LOCALE = "en-US";
	const progress = [
		`[download]${COLOR.cyan}`,
		new Intl.NumberFormat(LOCALE, {
			style: "percent",
			minimumFractionDigits: 1,
			maximumFractionDigits: 1
		}).format(downloadedPercent || 0).padStart(6, " "),
		`${COLOR.reset}of ~`,
		new Intl.NumberFormat(LOCALE, {
			notation: "compact",
			style: "unit",
			unit: estSize.unit,
			unitDisplay: "narrow"
		}).format(estSize.value).padStart(9, " "),
		`at${COLOR.green}`,
		new Intl.NumberFormat(LOCALE, {
			notation: "compact",
			style: "unit",
			unit: `${currentSpeed.unit}-per-second`,
			unitDisplay: "narrow"
		}).format(currentSpeed.value).padStart(11, " "),
		`${COLOR.reset}ETA${COLOR.yellow}`,
		new Intl.DateTimeFormat("en-GB", {
			hour: "numeric",
			minute: "numeric",
			second: "numeric",
			timeZone: "GMT"
		}).format((estTimeLeftSec || 0) * 1e3),
		`${COLOR.reset}(frag ${currentFragIdx}/${frags.length})\r`
	].join(" ");
	process.stdout.write(progress);
};

//#endregion
//#region src/downloaders.ts
const downloadWithFetch = async (url, destPath) => {
	const res = await fetch(url);
	const fileStream = fs.createWriteStream(destPath, { flags: "wx" });
	await stream.promises.finished(
		// @ts-expect-error
		stream.Readable.fromWeb(res.body).pipe(fileStream)
);
};
const downloadWithCurl = async (url, destPath, rateLimit) => {
	const curlArgs = [
		"-o",
		destPath,
		"--limit-rate",
		rateLimit,
		url
	];
	const exitCode = await spawn("curl", curlArgs, true);
	if (exitCode !== 0) throw new Error(`Curl error. Exit code: ${exitCode}`);
};
const downloadAndRetry = async (url, destPath, rateLimit, retryCount = 10) => {
	for (const [i] of Object.entries(Array.from({ length: retryCount }))) try {
		return rateLimit ? await downloadWithCurl(url, destPath, rateLimit) : await downloadWithFetch(url, destPath);
	} catch (e) {
		console.error(e.message);
		console.warn(`Can't download a url. Retry ${i + 1}`);
	}
};

//#endregion
//#region src/utils/downloadVideo.ts
const DEFAULT_OUTPUT_TEMPLATE = "%(title)s [%(id)s].%(ext)s";
const WAIT_BETWEEN_CYCLES_SECONDS = 60;
const downloadVideo = async (formats, videoInfo, getIsLive, args) => {
	if (args.values["list-formats"]) {
		console.table(formats.map(({ url,...rest }) => rest));
		process.exit();
	}
	const downloadFormat = args.values.format === "best" ? formats[0] : formats.find((f) => f.format_id === args.values.format);
	if (!downloadFormat) throw new Error("Wrong format");
	const outputPath = getPath.output(args.values.output || DEFAULT_OUTPUT_TEMPLATE, videoInfo);
	let isLive;
	let frags;
	let fragsCount = 0;
	let playlistUrl = downloadFormat.url;
	const fragsMetadata = [];
	while (true) {
		let playlist;
		[playlist, isLive] = await Promise.all([fetchText(playlistUrl, "playlist"), getIsLive()]);
		if (!playlist) {
			const newPlaylistUrl = downloadFormat.url.replace(/-muted-\w+(?=\.m3u8$)/, "");
			if (newPlaylistUrl !== playlistUrl) {
				playlistUrl = newPlaylistUrl;
				playlist = await fetchText(playlistUrl, "playlist (attempt #2)");
			}
		}
		if (!playlist) {
			console.log(`Can't fetch playlist. Retry after ${WAIT_BETWEEN_CYCLES_SECONDS} second(s)`);
			await setTimeout(WAIT_BETWEEN_CYCLES_SECONDS * 1e3);
			continue;
		}
		frags = getFragsForDownloading(playlistUrl, playlist, args.values["download-sections"]);
		await fsp.writeFile(getPath.playlist(outputPath), playlist);
		const hasNewFrags = frags.length > fragsCount;
		fragsCount = frags.length;
		if (!hasNewFrags && isLive) {
			console.log(`Waiting for new segments, retrying every ${WAIT_BETWEEN_CYCLES_SECONDS} second(s)`);
			await setTimeout(WAIT_BETWEEN_CYCLES_SECONDS * 1e3);
			continue;
		}
		let downloadedFragments = 0;
		for (let [i, frag] of frags.entries()) {
			const fragPath = getPath.frag(outputPath, frag.idx + 1);
			const fragTmpPath = `${fragPath}.part`;
			if (fs.existsSync(fragPath)) continue;
			showProgress(frags, fragsMetadata, i + 1);
			if (fs.existsSync(fragTmpPath)) await fsp.unlink(fragTmpPath);
			if (frag.url.endsWith("-unmuted.ts")) frag.url = frag.url.replace("-unmuted.ts", "-muted.ts");
			if (frag.url.endsWith("-muted.ts")) {
				const notMutedUrl = frag.url.replace("-muted.ts", ".ts");
				const res = await fetch(notMutedUrl, { method: "HEAD" });
				if (res.ok) frag.url = notMutedUrl;
			}
			const startTime = Date.now();
			await downloadAndRetry(frag.url, fragTmpPath, args.values["limit-rate"]);
			const endTime = Date.now();
			await fsp.rename(fragTmpPath, fragPath);
			const { size } = await fsp.stat(fragPath);
			fragsMetadata.push({
				size,
				time: endTime - startTime
			});
			downloadedFragments += 1;
		}
		if (downloadedFragments) process.stdout.write("\n");
		if (!isLive) break;
	}
	await mergeFrags(frags, outputPath, args.values["keep-fragments"]);
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
//#region src/utils/downloadLiveVideo.ts
const WAIT_AFTER_STREAM_ENDED_SECONDS = 8 * 60;
const downloadLiveVideo = async (streamMeta, channelLogin, args) => {
	let formats = [];
	let videoInfo;
	let videoId;
	if (!streamMeta.stream) return false;
	const broadcast = await getBroadcast(streamMeta.id);
	if (broadcast?.stream?.archiveVideo) {
		videoId = broadcast.stream.archiveVideo.id;
		[formats, videoInfo] = await Promise.all([getVideoFormats(videoId), getVideoMetadata(videoId).then((videoMeta) => getVideoInfoByVideoMeta(videoMeta))]);
	}
	if (!broadcast?.stream?.archiveVideo || formats.length === 0) {
		console.warn("Couldn't find an archived video for the current broadcast. Trying to recover a VOD url");
		const startTimestamp = new Date(streamMeta.stream.createdAt).getTime() / 1e3;
		const vodPath = `${channelLogin}_${streamMeta.stream.id}_${startTimestamp}`;
		formats = await getVideoFormatsByFullVodPath(getFullVodPath(vodPath));
		videoInfo = getVideoInfoByStreamMeta(streamMeta, channelLogin);
	}
	const streamId = broadcast?.stream?.id;
	let lastLiveTimestamp = Date.now();
	const getIsVodLive = (thumbUrl) => /\/404_processing_[^.?#]+\.png/.test(thumbUrl);
	const getSecondsAfterStreamEnded = (videoMeta) => {
		const started = new Date(videoMeta.publishedAt);
		const ended = new Date(started.getTime() + videoMeta.lengthSeconds * 1e3);
		return Math.floor((Date.now() - ended.getTime()) / 1e3);
	};
	const getIsLive = async () => {
		let videoMeta = null;
		if (videoId) {
			videoMeta = await getVideoMetadata(videoId);
			const isLive = !videoMeta || getIsVodLive(videoMeta.previewThumbnailURL);
			if (isLive) return true;
			const secondsAfterEnd = getSecondsAfterStreamEnded(videoMeta);
			return WAIT_AFTER_STREAM_ENDED_SECONDS - secondsAfterEnd > 0;
		}
		if (!videoId || !videoMeta) {
			const broadcast$1 = await getBroadcast(streamMeta.id);
			if (!broadcast$1?.stream || broadcast$1.stream.id !== streamId) {
				const secondsAfterEnd = (Date.now() - lastLiveTimestamp) / 1e3;
				return WAIT_AFTER_STREAM_ENDED_SECONDS - secondsAfterEnd > 0;
			} else {
				lastLiveTimestamp = Date.now();
				return true;
			}
		}
		return false;
	};
	if (formats.length === 0) {
		console.warn("Couldn't find a VOD url");
		return false;
	}
	await downloadVideo(formats, videoInfo, getIsLive, args);
	return true;
};

//#endregion
//#region src/utils/downloadWithStreamlink.ts
const DEFAULT_STREAMLINK_ARGS = ["--twitch-force-client-integrity", "--twitch-access-token-param=playerType=frontpage"];
const getDefaultOutputTemplate = () => {
	const now = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "_");
	return `%(uploader)s (live) ${now} [%(id)s].%(ext)s`;
};
const downloadWithStreamlink = async (link, streamMeta, channelLogin, args) => {
	if (args.values["list-formats"]) {
		await spawn("streamlink", ["-v", link]);
		process.exit();
	}
	const outputPath = getPath.output(args.values.output || getDefaultOutputTemplate(), getVideoInfoByStreamMeta(streamMeta, channelLogin));
	const streamlinkArgs = [];
	for (const argName of Object.keys(args.values)) {
		if (!argName.startsWith("twitch-")) continue;
		const argValue = args.values[argName];
		if (argValue === void 0) continue;
		if (Array.isArray(argValue)) for (const v of argValue) streamlinkArgs.push(`--${argName}=${v}`);
		else streamlinkArgs.push(typeof argValue === "boolean" ? `--${argName}` : `--${argName}=${argValue}`);
	}
	return spawn("streamlink", [
		"-o",
		outputPath,
		link,
		args.values.format,
		...streamlinkArgs.length ? streamlinkArgs : DEFAULT_STREAMLINK_ARGS
	]);
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
		"merge-fragments": { type: "boolean" },
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
	const args = getArgs();
	if (args.values.help || args.positionals.length === 0) {
		console.log(HELP);
		return;
	}
	if (args.values["merge-fragments"]) {
		const [outputPath] = args.positionals;
		const [playlist, allFiles] = await Promise.all([fsp.readFile(getPath.playlist(outputPath), "utf8"), fsp.readdir(path.parse(outputPath).dir || ".")]);
		const frags = getFragsForDownloading(".", playlist, args.values["download-sections"]);
		const existingFrags = frags.filter((frag) => {
			const fragPath = getPath.frag(outputPath, frag.idx + 1);
			return allFiles.includes(path.parse(fragPath).base);
		});
		await mergeFrags(existingFrags, outputPath, true);
		return;
	}
	if (args.positionals.length > 1) throw new Error("Expected only one link");
	const [link] = args.positionals;
	const parsedLink = parseLink(link);
	if (parsedLink.type === "vodPath") {
		const formats = await getVideoFormatsByFullVodPath(getFullVodPath(parsedLink.vodPath));
		const videoInfo = getVideoInfoByVodPath(parsedLink);
		return downloadVideo(formats, videoInfo, () => false, args);
	}
	if (parsedLink.type === "video") {
		let [formats, videoMeta] = await Promise.all([getVideoFormats(parsedLink.videoId), getVideoMetadata(parsedLink.videoId)]);
		if (formats.length === 0 && videoMeta !== null) {
			console.log("Trying to get playlist url from video metadata");
			formats = await getVideoFormatsByThumbUrl(videoMeta.broadcastType, videoMeta.id, videoMeta.previewThumbnailURL);
		}
		if (formats.length === 0 || !videoMeta) return console.log(PRIVATE_VIDEO_INSTRUCTIONS);
		const videoInfo = getVideoInfoByVideoMeta(videoMeta);
		return downloadVideo(formats, videoInfo, () => false, args);
	}
	const { channelLogin } = parsedLink;
	let retryStreamsDelay = 0;
	if (args.values["retry-streams"]) {
		retryStreamsDelay = Number.parseInt(args.values["retry-streams"]);
		if (!retryStreamsDelay || retryStreamsDelay < 0) throw new Error("Wrong --retry-streams delay");
	}
	const isLiveFromStart = args.values["live-from-start"];
	if (!retryStreamsDelay) {
		const streamMeta = await getStreamMetadata(channelLogin);
		if (!streamMeta) return;
		if (!streamMeta.stream) {
			console.warn("The channel is not currently live");
			return;
		}
		if (!isLiveFromStart) return await downloadWithStreamlink(`https://www.twitch.tv/${channelLogin}`, streamMeta, channelLogin, args);
		if (isLiveFromStart) return await downloadLiveVideo(streamMeta, channelLogin, args);
	}
	while (true) {
		const streamMeta = await getStreamMetadata(channelLogin);
		const isLive = !!streamMeta?.stream;
		if (!isLive) console.log(`Waiting for streams, retrying every ${retryStreamsDelay} second(s)`);
		if (isLive && !isLiveFromStart) await downloadWithStreamlink(`https://www.twitch.tv/${channelLogin}`, streamMeta, channelLogin, args);
		if (isLive && isLiveFromStart) {
			const isSuccess = await downloadLiveVideo(streamMeta, channelLogin, args);
			if (!isSuccess) console.log(`Waiting for VOD, retrying every ${retryStreamsDelay} second(s)`);
		}
		await setTimeout(retryStreamsDelay * 1e3);
	}
};
main().catch((e) => {
	console.error(e.message);
});

//#endregion