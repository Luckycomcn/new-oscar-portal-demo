function Read-MapEnvironment {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Environment file not found: $Path" }
    $result = @{}
    $allowed = @('VITE_AMAP_KEY', 'VITE_TIANDITU_KEY', 'VITE_AMAP_SECURITY_JS_CODE', 'AMAP_SECURITY_JS_CODE')
    $lineNumber = 0
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        $lineNumber++
        if ($line -notmatch '^\s*(?:export\s+)?(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*)$') { continue }
        $name = $Matches['name']; $value = $Matches['value'].Trim()
        if ($name -notin $allowed) { continue }
        if ($value.StartsWith('"') -or $value.StartsWith("'")) {
            if ($value -notmatch '^(?<quote>["''])(?<content>.*?)\k<quote>\s*(?:#.*)?$') { throw "Invalid quoted value for $name at line $lineNumber." }
            $value = $Matches['content']
        } else { $value = ($value -replace '\s+#.*$', '').Trim() }
        if ($value.Contains("`r") -or $value.Contains("`n") -or $value.Contains([string][char]0)) { throw "Invalid multiline value for $name." }
        $result[$name] = $value
    }
    return $result
}
