param(
    [Parameter(Mandatory = $true)]
    [string]$Version
)

# --- game.js ---------------------------------------------------------------
$gamePath = 'game.js'
$game = Get-Content -Path $gamePath -Raw
$game = [regex]::Replace($game, "const APP_VERSION = '.*?'", "const APP_VERSION = '$Version'")
Set-Content -Path $gamePath -Value $game -Encoding UTF8

# --- index.html --------------------------------------------------------------
$htmlPath = 'index.html'
$html = Get-Content -Path $htmlPath -Raw
$html = [regex]::Replace($html, '<meta name="app-version" content="[^"]+" />', '<meta name="app-version" content="' + $Version + '" />')
$html = [regex]::Replace($html, 'style\.css\?v=[^"]+', 'style.css?v=' + $Version)
$html = [regex]::Replace($html, 'game\.js\?v=[^"]+', 'game.js?v=' + $Version)
Set-Content -Path $htmlPath -Value $html -Encoding UTF8

# --- version.json ------------------------------------------------------------
$jsonPath = 'version.json'
$json = '{"version": "' + $Version + '"}'
Set-Content -Path $jsonPath -Value $json -Encoding UTF8

Write-Host "Version stamped: $Version"
Write-Host "  - game.js updated"
Write-Host "  - index.html updated (meta tag, style.css?v=, game.js?v=)"
Write-Host "  - version.json updated"
