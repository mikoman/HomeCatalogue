# Font sources

These files are unchanged Latin subsets from the official Google Fonts service.
Both fonts use the normal, upright style. The application can serve them from `/fonts/`.

| File | CSS family | CSS weights | Font weight axis | Size |
| --- | --- | --- | --- | --- |
| `lora-latin-variable.woff2` | `Lora` | 400–700 | 400–700 | 37,792 bytes |
| `source-sans-3-latin-variable.woff2` | `Source Sans 3` | 200–900 | 200–900 | 28,792 bytes |

The application declares each font’s full weight axis. The download request used a narrower range.

## Download sources

Downloaded on 2026-09-11 from these sources:

- [Google Fonts CSS request](https://fonts.googleapis.com/css2?family=Lora:wght@400..600&family=Source+Sans+3:wght@400..700&display=swap)
- [Lora Latin WOFF2, version 37](https://fonts.gstatic.com/s/lora/v37/0QIvMX1D_JOuMwr7I_FMl_E.woff2)
- [Source Sans 3 Latin WOFF2, version 19](https://fonts.gstatic.com/s/sourcesans3/v19/nwpStKy2OAdR1K-IwhWudF-R3w8aZejf5Hc.woff2)
- [Lora licence source](https://raw.githubusercontent.com/google/fonts/main/ofl/lora/OFL.txt)
- [Source Sans 3 licence source](https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/OFL.txt)

The Google CSS response identified both files as the `latin` subset.
It specified this Unicode range for each font:

```text
U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD
```

## Licences

Both fonts use the SIL Open Font License, version 1.1.
The licence files retain their copyright notices and reserved font names.
Licence files use LF line endings and omit trailing spaces. The licence wording is unchanged.

- `Lora-OFL.txt`: The Lora Project Authors, 2011. Reserved Font Name: `Lora`. Size: 4,422 bytes.
- `SourceSans3-OFL.txt`: Adobe, 2010–2020. Reserved Font Name: `Source`. Size: 4,485 bytes.

## Verification

Both files have valid WOFF2 signatures and matching file lengths.
Their Brotli streams decompress successfully and match the table directory lengths.
Each file contains a variable `wght` axis with the limits shown above.
The system `file` command identifies both files as WOFF2 TrueType fonts.

SHA-256:

```text
6b102ab35aa1f2b315788bb4853434ed1e52137603bf7a3da71a682276748d45  lora-latin-variable.woff2
ac057a5593cbe3df0d2585da5dd5f33b8efa84aa30550c710fe061b37fc5c54b  source-sans-3-latin-variable.woff2
6d6bc7bbb828514925dabcaf89e4771398d12c60dd1cb2bbb90eea129535d0f4  Lora-OFL.txt
7fac2f6c6bc47144e2c35e8f41147b3c8c895490d44b46266a5312fe93364d2e  SourceSans3-OFL.txt
```
