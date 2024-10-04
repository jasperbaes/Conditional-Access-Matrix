<br>
<p align="center">
  <a href="https://jbaes.be/CAB">
    <img src="./assets/logo.png" alt="Logo" height="130">
  </a>
  <h3 align="center">Conditional Access Impact Matrix</h3>
  <p align="center">
    By Jasper Baes
    <br />
    <a href="https://github.com/jasperbaes/Conditional-Access-Matrix#installation">Installation</a>
    ·
    <a href="https://github.com/jasperbaes/Conditional-Access-Matrix/issues">Report Bug</a>
    ·
     <a href="https://www.jbaes.be/CAB">Conditional Access Blueprint</a>
  </p>
</p>



The Conditional Access Impact Matrix is tool #3 in the <a href="https://www.jbaes.be/CAB">Conditional Access Blueprint</a>.

This script solves 2 problems:
- what CA policies are applied to who?
- what is the user impact of my recent CA policy changes?


Generated excel:

<img src="./assets/matrix.png" alt="Logo" width=60%>

Generated impact:

<img src="./assets/impact.png" alt="Logo" width=60%>

Features:
- extract an Excel visualizing which CA policies are applied on each user
- filter in this table
- identify gaps and misconfigurations
- Predict user impact before enabling CA policies
- for documentation and compliance purposes
- easily and quickly answer questions like:
  - what accounts have MFA enabled/disabled?
  - what accounts are excluded form having a compliant device?
  - what accounts are allowed to use legacy auth?
  - ...
- visualize how recent CA changes impacted your users

## Usage

Examples:

```sh
node index.js
node index.js --include-report-only
node index.js --compare 2024-09-01-CA-Impact-Matrix.json
node index.js --compare 2024-09-01-CA-Impact-Matrix.json --include-report-only
```


| Parameter           |               Description |
| ----------------- | --------------------------------------------------------------: |
| `--include-report-only` | Adding this parameter will also include Conditional Access policies in the 'report-only' state  |
| `--compare 2024-09-01-CA-Impact-Matrix.json` | Adding this parameter will compare the current output to a previous generated output  |

What running the script looks like:

<img src="./assets/terminal.png" alt="Logo" width=60%>

## Installation

<a href="./assets/manual-1.png" target="_blank"><img src="./assets/manual-1.png" width="60%" /></a> <br>
<a href="./assets/manual-2.png" target="_blank"><img src="./assets/manual-2.png" width="60%" /></a> <br>
<a href="./assets/manual-3.png" target="_blank"><img src="./assets/manual-3.png" width="60%" /></a> <br>


## Limitations
- Subgroups might not be fully evaluated
- Conditional Access policies scoped on users with Entra roles might not be evaluated

## Contact

Jasper Baes (https://www.linkedin.com/in/jasper-baes)

## Release history

Release version numbers: YEAR-WEEK

- 2024.40
  - updated installation guide
  - added .env template file
- 2024.39
  - added parameter for 'report-only' CA policies
  - bugfix ([#1](https://github.com/jasperbaes/Conditional-Access-Matrix/issues/1))
- 2024.38
  - initial release (open-source)

## License

Please be aware that the Conditional Access Impact Matrix code is intended solely for individual administrators' personal use. It is not licensed for use by organizations seeking financial gain. This restriction is in place to ensure the responsible and fair use of the tool. Admins are encouraged to leverage this code to enhance their own understanding and management within their respective environments, but any commercial or organizational profit-driven usage is strictly prohibited.

Thank you for respecting these usage terms and contributing to a fair and ethical software community. 

Jasper Baes (https://www.linkedin.com/in/jasper-baes)

Buy Me a Coffee (https://buymeacoffee.com/jasperbaes)