$files = @(
    "FrontEnd/CSS/accounting_common.css",
    "FrontEnd/CSS/expense.css",
    "FrontEnd/CSS/incident.css",
    "FrontEnd/CSS/index.css",
    "FrontEnd/CSS/login.css",
    "FrontEnd/CSS/monthly_quota.css",
    "FrontEnd/CSS/payment.css",
    "FrontEnd/CSS/receipt.css",
    "FrontEnd/CSS/tower_fund.css"
)

$modified = @()
$skipped = @()
$marker = "/* Footer anchoring fix */"
$block = @"
/* Footer anchoring fix */
body {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}
"@

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content -Path $file -Raw -Encoding UTF8
        if ($content -like "*$marker*") {
            $skipped += $file
        } else {
            $newContent = $content + "`r`n`r`n" + $block
            [System.IO.File]::WriteAllText($file, $newContent, [System.Text.Encoding]::UTF8)
            $modified += $file
        }
    }
}

Write-Output "ARCHIVOS MODIFICADOS:"
$modified | ForEach-Object { Write-Output "  $_" }
Write-Output ""
Write-Output "ARCHIVOS OMITIDOS:"
$skipped | ForEach-Object { Write-Output "  $_" }
Write-Output ""
Write-Output "Resumen: $($modified.Count) modificados, $($skipped.Count) omitidos"
