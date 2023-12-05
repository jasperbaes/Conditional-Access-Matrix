
<br>
<p align="center">
  <h3 align="center">Conditional Access User Matrix</h3>

  <p align="center">
    By Jasper Baes, for Toreon
    <br />
    <a href="https://github.com/Toreon/MicrosoftCloud#projects">What and why</a>
    ·
    <a href="https://github.com/Toreon/MicrosoftCloud/issues">Report Bug</a>
    ·
    <a href="https://security.toreon.com/docs">Toreon Compliance Manager</a>
  </p>
</p>

## What and why

View visualized version: 
[![LinkedIn][linkedin-shield]][[linkedin-url](https://www.linkedin.com/in/jasper-baes/)]


<img src="./screenshot.png" alt="Logo" width=75%>

This script helps solve a frequent problem: the lack of visibility of which CA policies are applied on each users. These insights are essential in order to use Conditional Access to it’s full extend with the guarantee no users are forgotten about, or no misconfigurations are in place.

What is offered:
- extract an Excel visualizing which CA policies are applied on each user
- filter in this table
- identify gaps and misconfigurations
- for documentation and compliance purposes
- easily and quickly answer questions like:
  - what accounts have MFA enabled/disabled?
  - what accounts are excluded form having a compliant device?
  - what accounts are allowed to use legacy auth?
  - ..

These insights are especially needed in larger or more complex environments.

## Installation

Visual installation guide will be published on LinkedIn of Jasper Baes (LINKEDIN) on December 19, 2023.

1. Create an Azure App Registration
2. Clone Github Repository
    
    Clone the repo:
   ```sh
   git clone https://github.com/your_username_/Project-Name.git
   ```
1. Go in the folder and install node and dependencies

    ```sh
   npm install
   ```
2. Set variables in index.js
  
   ```js
   var tenantID = ''
   var clientID = ''
   var clientSecret = ''
   ```
3. Run
    ```sh
   node index.js
   ```

## Contributing

Code contributor(s):
- Jasper Baes (LINKEDIN)

## Limitations
- Subgroups might not be fully evaluated

## Contact

Jasper Baes (jasper.baes@toreon.com)