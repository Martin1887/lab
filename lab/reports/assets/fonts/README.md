# Minimising Nerd Font

Nerd Fonts contain a lot of useful Unicode symbols, but the size of the full
font and CSS is huge. See the Nerd Fonts licenses here:
<https://github.com/ryanoasis/nerd-fonts/blob/master/LICENSE>.

The full CSS available in <https://www.nerdfonts.com/assets/css/webfont.css>
is manually filtered with only the used characters into `../css/nerdfont.css`.

Characters can be found in <https://www.nerdfonts.com/cheat-sheet>.

The full woff2 file is loaded by the original full CSS file, and available here:
<https://www.nerdfonts.com/assets/fonts/Symbols-2048-em> Nerd Font Complete.woff2.

The following command extracts the needed symbols from the woff2 file into a
tiny woff2 via fonttools (<https://github.com/fonttools/fonttools>),
which is embedded in base64 by `markup.py`:

    pyftsubset NerdFontSymbolsComplete.woff2 --unicodes="U+0020-0025" \
    --flavor=woff2 --output-file=Symbols-NerdFont-min.woff2 \
    --layout-features=* --notdef-glyph --recommended-glyphs \
    --name-IDs=* --name-languages=*

The script `update_symbols_font.sh` generates the CSS and the woff2 file if
`NerdFontSymbolsComplete.css` and `NerdFontSymbolsComplete.woff2` exist in the
same directory.
To add new symbols add their CSS classes into the `SYMBOLS` array inside the
script and execute it.
