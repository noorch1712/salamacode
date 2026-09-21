param([switch]$OnlyCheck = $false)

$ErrorActionPreference = 'Continue'
$root = 'D:\salamacode\salamacode'
$bundle = Join-Path $root 'dist\server-total.cjs'

if ($OnlyCheck) {
    if (-not (Test-Path -LiteralPath $bundle)) {
        Write-Output "BUNDEL_TIDAK_ADA"
        exit 2
    }
    $cjs = Get-Content -Raw -LiteralPath $bundle
    $ext = [regex]::Matches($cjs, "require\(['""]([a-zA-Z@][^'""/]*)['""]\)") |
        ForEach-Object { $_.Groups[1].Value } |
        Where-Object { $_ -notmatch '^(node[:]?|assert|async_hooks|buffer|bufferutil|child_process|cluster|console|constants|crypto|dgram|diagnostics_channel|dns|domain|events|fs|http|http2|https|module|net|os|path|perf_hooks|process|punycode|querystring|readline|repl|stream|string_decoder|sys|timers|tls|trace_events|tty|url|util|v8|vm|wasi|worker_threads|zlib|utf-8-validate|iconv-lite|supports-color|@babel|@esbuild|@jridgewell|@napi|caniuse|electron|esbuild|lightningcss|vite|lucide|motion|prismjs|react|tailwindcss|google-gax|gaxios|gcp-metadata|google-auth-library|abort-controller|base64-js|bignumber.js|bufferutil|color|color-convert|color-name|combined-stream|component-emitter|cookie|debug|delayed-stream|dotenv|ecdsa-sig-formatter|estraverse|event-target-shim|extend|fast-safe-stringify|follow-redirects|form-data|google-p12-pem|gtoken|http-errors|iconv-lite|jwa|jws|lie|lru-cache|mime|mime-db|ms|node-forge|node-fetch|oauth|object-inspect|once|p-limit|qs|readable-stream|safe-buffer|safer-buffer|semver|setimmediate|statuses|string_decoder|toidentifier|tslib|unpipe|util-deprecate|vite|whatwg-url|wrappy|ws|xtend|uuid|teeny-request|proto3-json-serializer|protobufjs|long|retry-axios|gaxios|node-forge|jwa|jws|jose|express|escape-html|content-type|ee-first|destroy|on-finished|finalhandler|send|serve-static|methods|parseurl|range-parser|vary|proxy-addr|forwarded|ipaddr.js|accepts|negotiator|type-is|media-typer|mime-types|depd|path-to-regexp|array-flatten|body-parser|raw-body|bytes|unpipe|etag|fresh|merge-descriptors|encodeurl|destroy|faye-websocket|websocket-driver|websocket-extensions|prismjs|parseurl|encodeurl|supports-color|has-flag|color|color-convert|color-name|emoji-regex|string-width|strip-ansi|safe-buffer|readable-stream|once|wrappy|readable-stream|inherits|isarray|core-util-is|process-nextick-args|util-deprecate|string_decoder|safe-buffer|buffer|base64-js|ieee754|bintell|bun|node-lame|winreg|keytar|sequelize|better-sqlite3|sqlite3|sharp|canvas|bcrypt|argon2|knex|pg-native|msgpackr|msgpackr-extract|better-queue|electron-store|keytar|sqlite|ws|no-case|lower-case|lower-case-first|tslib|no-case|camelcase|case-anything|param-case|proper-lower-case|sentence-case|sponge-case|swap-case|title-case|upper-case|upper-case-first|change-case|pascal-case|constant-case|dot-case|header-case|kebab-case|sentence-case|sponge-case|swap-case|title-case|upper-case-first|upper-case|is-array|is-lower-case|is-upper-case|capital-case|camelcase|no-capitalization|escape-string-regexp|clone|tslib|color-string|color-name|color-convert|color|color-string|color-parse|color-name|color-convert|color|classnames|clsx|use-sync-external-store|motion-dom|motion-utils|popmotion|framesync|hey-listen|tslib| style-value-types|style-to-object|camelcase|css|css-tree|postcss|cssesc|source-map-js|nanoid|picocolors|postcss|postcss-value-parser|postcss-selector-parser|tailwindcss|tailwindcss|@tailwindcss|resolve|picocolors|postcss' ) }
    
    if ($ext.Count -gt 0) {
        Write-Output "EKSTERNAL_TERTINGGAL: $($ext -join ', ')"
        exit 1
    } else {
        Write-Output "OK_BUNDEL_MANDIRI"
        exit 0
    }
}

# Jalur produksi penuh:
Write-Output "=== skenario produksi penuh (identik dengan Suga/Docker) ==="
Set-Location -LiteralPath $root

# 1) build frontend Vite
Write-Output "--- 1) vite build (frontend) ---"
& node "node_modules\vite\bin\vite.js" build 2>&1 | Out-String | Write-Output

# 2) bundle server total
Write-Output "--- 2) esbuild bundle server total ---"
& node "node_modules\esbuild\bin\esbuild.js" server.ts --bundle --platform=node --format=cjs --external:electron --external:vite --outfile=dist\server-total.cjs 2>&1 | Out-String | Write-Output

# 3) verifikasi
Write-Output "--- 3) verifikasi ---"
& node (Join-Path $root 'scripts\check-bundle.ps1') -OnlyCheck 2>&1 | Out-String

Write-Output "SELESAI_PRODUKSI"
