#!bash

SYMBOLS=(.nf-fae-tools .nf-fa-sort_asc .nf-fa-sort_desc .nf-fa-filter .nf-oct-eye
    .nf-fa-plus_circle .nf-fa-minus_circle .nf-md-close_circle .nf-md-backup_restore)

source=NerdFontSymbolsComplete
sourcecss=$source.css
sourcefont=$source.woff2
filename=Symbols-NerdFont-min
cssfile=../css/$filename.css
fontfile=$filename.woff2
utfcodes=""

cat font_css_header.css >$cssfile

for symbol in "${SYMBOLS[@]}"; do
    css=$(grep -E "$symbol:before{content:[\"\\0-9a-f]+}" -o $sourcecss)
    echo $css >>$cssfile
    # Extract the UTF-8 code.
    utf=$(echo $css | cut -f2 --delimiter "\"")
    # Remove the backslash.
    utf=${utf:1:4}
    if [ -z $utfcodes ]; then
        utfcodes=$utf
    else
        utfcodes=$utfcodes,$utf
    fi
done

pyftsubset $sourcefont --unicodes="$utfcodes" \
    --flavor=woff2 --output-file=$fontfile \
    --layout-features=* --notdef-glyph --recommended-glyphs \
    --name-IDs=* --name-languages=*
