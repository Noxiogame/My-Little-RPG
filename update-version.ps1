param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

# IMPORTANT: Windows PowerShell's Get-Content/Set-Content default to the
# system ANSI codepage when a file has no BOM, which is exactly the case for
# game.js/index.html (plain UTF-8, no BOM). That silently corrupted every
# accented character (é, è, à, ’, …) on each run and also added a stray UTF-8
# BOM to the front of the files. Reading/writing explicitly via .NET's
# File::ReadAllText/WriteAllText with a BOM-less UTF8Encoding sidesteps both
# problems regardless of which PowerShell version/edition runs this script.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Read-Utf8File([string]$path) {
    return [System.IO.File]::ReadAllText((Resolve-Path $path), $utf8NoBom)
}

function Write-Utf8File([string]$path, [string]$content) {
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, $utf8NoBom)
}

# --- game.js -----------------------------------------------------------
$gamePath = 'game.js'
$game = Read-Utf8File $gamePath
$game = [regex]::Replace($game, "const APP_VERSION = '.*?'", "const APP_VERSION = '$Version'")
Write-Utf8File $gamePath $game

# --- index.html ----------------------------------------------------------
$htmlPath = 'index.html'
$html = Read-Utf8File $htmlPath
$html = [regex]::Replace($html, '<meta name="app-version" content="[^"]+" />', '<meta name="app-version" content="' + $Version + '" />')
$html = [regex]::Replace($html, 'style\.css\?v=[^"]+', 'style.css?v=' + $Version)
$html = [regex]::Replace($html, 'game\.js\?v=[^"]+', 'game.js?v=' + $Version)
Write-Utf8File $htmlPath $html

# --- version.json ----------------------------------------------------------
$jsonPath = 'version.json'
$json = '{"version": "' + $Version + '"}'
Write-Utf8File $jsonPath $json

Write-Host "Version stamped: $Version"
Write-Host "  - game.js updated (UTF-8, no BOM)"
Write-Host "  - index.html updated (UTF-8, no BOM)"
Write-Host "  - version.json updated (UTF-8, no BOM)"
