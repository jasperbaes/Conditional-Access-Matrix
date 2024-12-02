const index = require('./index');
const axios = require('axios');
const msal = require('@azure/msal-node');
var fs = require('fs');
let converter = require('json-2-csv');
const NodeCache = require( "node-cache" );
const myCache = new NodeCache();

// express
try {
    const express = require('express')
    global.app = express()
    global.port = 3000
} catch (error) {
    console.log(` [${fgColor.FgRed}X${colorReset}] ${fgColor.FgRed}ERROR${colorReset}: 'Express' module not installed. Run 'npm install'`);
    console.log(`\n ${error} \n`)
    process.exit() // exiting
}

async function onLatestVersion() {
    // this function shows a message if the version of the tool equals the latest uploaded version in Github
    try {
        // fetch latest version from Github
        const response = await axios.default.get('https://raw.githubusercontent.com/jasperbaes/Conditional-Access-Matrix/master/assets/latestVersion.json');
        let latestVersion = response?.data?.latestVersion

        // if latest version from Github does not match script version, display update message
        if (response.data) {
            if (latestVersion !== currentVersion) {
                console.log(` ${fgColor.FgGray}[${fgColor.FgRed}-${fgColor.FgGray}] ${fgColor.FgRed}update available!${fgColor.FgGray} Run 'git pull' and 'npm install' to update from ${currentVersion} --> ${latestVersion}${colorReset}`)
            }
        }
    } catch (error) { // no need to log anything
    }
}

async function getToken() {
    var msalConfig = {
        auth: {
            clientId: clientID,
            authority: 'https://login.microsoftonline.com/' + tenantID,
            clientSecret: clientSecret,
        }
    };

    const tokenRequest = {
        scopes: [
            'https://graph.microsoft.com/.default'
        ]
    };
    
    try {
        const cca = new msal.ConfidentialClientApplication(msalConfig);
        return await cca.acquireTokenByClientCredential(tokenRequest);
    } catch (error) {
        console.log(`\n [${fgColor.FgRed}X${colorReset}] ${fgColor.FgRed}ERROR${colorReset}: Something went wrong generating an access token. Please check the script .env file and application permissions in Entra`);
        console.log(`\n ${error} \n`)
        console.log(` [${fgColor.FgRed}X${colorReset}] Exiting...`);
        process.exit()
    }
    
}

async function getAllWithNextLink(accessToken, urlParameter) {
    let arr = []
    let url = "https://graph.microsoft.com" + urlParameter

    try {
        do {
            let res =  await callApi(url, accessToken);
            let data = await res?.value
            url = res['@odata.nextLink']
            arr.push(...data)
        } while(url)
    } catch (error) {
        
    }

    return arr
}

async function callApi(endpoint, accessToken) {    
    // if the result is already in cache, then immediately return that result
    try {
        if (myCache.get(endpoint) != undefined) {
            return myCache.get(endpoint)
        }
    } catch (error) {
        console.error(` [${fgColor.FgRed}X${colorReset}] Error getting local cache.${colorReset}\n\n`, error)
    }

    const options = {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    };

    try {
        const response = await axios.default.get(endpoint, options);
        
        // add to local cache
        if (myCache.get(endpoint) == undefined) {
            myCache.set(endpoint, response.data, 120); // save to cache for 120 seconds
        }

        return response.data;
    } catch (error) {
        console.log(` [${fgColor.FgRed}X${colorReset}] ${fgColor.FgRed}ERROR${colorReset}: Something went wrong fetching from the Microsoft Graph API. Please check the script .env file and application permissions in Entra`);
        console.log(`\n ${error} \n`)
        console.log(` [${fgColor.FgRed}X${colorReset}] Exiting...`);
        process.exit()
    }
};

async function generateWebReport(changes) { // generates and opens a web report
    // if --cli-only is specified, stop function
    if (scriptParameters.some(param => ['--cli-only', '-cli-only', '--clionly', '-clionly'].includes(param.toLowerCase()))) {
        return; // stop function
    } 

    // host files
    app.get('/style.css', function(req, res) { res.sendFile(__dirname + "/assets/" + "style.css"); });
    app.get('/AvenirBlack.ttf', function(req, res) { res.sendFile(__dirname + "/assets/fonts/" + "AvenirBlack.ttf"); });
    app.get('/AvenirBook.ttf', function(req, res) { res.sendFile(__dirname + "/assets/fonts/" + "AvenirBook.ttf"); });
    app.get('/logo.png', function(req, res) { res.sendFile(__dirname + "/assets/" + "logo.png"); });

    // host report page
    app.get('/', (req, res) => {
        let htmlContent = `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
              <link rel="stylesheet" href="style.css">
              <title>Conditional Access Impact Matrix</title>
            </head>
            <body>
              <div class="container mt-5 mb-5">
                <h1 class="mb-0 text-center font-bold color-primary">Conditional Access <span class="font-bold color-accent px-2 py-0">Impact Matrix</span></h1>
                <p class="text-center mt-3 mb-5 color-secondary">Review the effects of your Conditional Access changes</p>
                
               <table class="table mb-5">
                <thead>
                    <tr class="font-bold">
                        <th scope="col">user</th>
                        <th scope="col">CA policy</th>
                        <th scope="col">old value</th>
                        <th scope="col">new value</th>
                    </tr>
                </thead>
                <tbody>
        `
        changes.forEach(change => {
            htmlContent += `
                <tr>
                    <td scope="col">${change.upn}</td>
                    <td scope="col">${change.policy}</td>
                    <td scope="col">${change.old}</td>
                    <td scope="col">${change.new}</td>
                </tr>
            `
        })

        if (changes.length == 0) {
            htmlContent += `
                    </tbody>
                </table>

                <p class="text-center my-3">No user changes</p>
            `
        } else {
            htmlContent += `
                    </tbody>
                </table>
            `
        }

        htmlContent += `
            <p class="text-center mt-5 mb-0"><a class="color-primary font-bold text-decoration-none" href="https://github.com/jasperbaes/Conditional-Access-Matrix" target="_blank">Conditional Access Impact Matrix</a>, made by <a class="color-accent font-bold text-decoration-none" href="https://www.linkedin.com/in/jasper-baes" target="_blank">Jasper Baes</a></p>
            <p class="text-center mt-1 mb-0 small"><a class="color-secondary" href="https://github.com/jasperbaes/Conditional-Access-Matrix" target="_blank">https://github.com/jasperbaes/Conditional-Access-Matrix</a></p>
            <p class="text-center mt-1 mb-5 small">This tool is part of the <a class="color-secondary font-bold" href="https://jbaes.be/Conditional-Access-Blueprint" target="_blank">Conditional Access Blueprint</a></p>
            </body>
          </html>
        `
        
     
        res.send(htmlContent);
      });

    app.listen(port, async () => {
        console.log(` [${fgColor.FgGreen}✓${colorReset}] Your web report is automatically opening on http://localhost:${port}`);
        const open = await import('open');
        await open.default(`http://localhost:${port}`);
    })
}

async function exportJSON(arr, filename) { // export array to JSON file  in current working directory
    fs.writeFile(filename, JSON.stringify(arr, null, 2), 'utf-8', err => {
        if (err) return console.error(` ERROR: ${err}`);
        console.log(` [${fgColor.FgGreen}✓${colorReset}] '${filename}' saved in current directory`);
    });
}

async function compare(previousMatrix, currentMatrix) {
    let changes = []

    currentMatrix.forEach(userRow => {
        // find user in previous scan
        let userRowSecondLast = previousMatrix?.find(x => x?.upn == userRow?.upn)
        
        if (userRowSecondLast) { // if user is also in previous scan
            let differentProperties = [];
            for (let property in userRow) { // loop over all objects 
                if (userRow[property] !== userRowSecondLast[property]) {
                    // below line is commented to allow new CA policy changes to be included (https://github.com/jasperbaes/Conditional-Access-Matrix/issues/7)

                    // if (userRow[property] !== null && userRow[property] !== undefined && userRowSecondLast[property] !== null && userRowSecondLast[property] !== undefined) {
                        differentProperties.push(property);
                    // }
                }
            }
            
            if (differentProperties.length > 0) {
                // remove job, upn, user and external property
                differentProperties.filter(element => !['user', 'upn', 'job', 'external'].includes(element)).forEach(property => {
                    changes.push({
                        upn: userRow.upn,
                        policy: property,
                        old: (userRowSecondLast[property] === undefined) ? '/' : (userRowSecondLast[property] ? '✅ Included' : '❌ Excluded'),
                        new: (userRow[property] === undefined) ? '/' : (userRow[property] ? '✅ Included' : '❌ Excluded')
                    })
                })
            }
        }
    })

    console.log(` [${fgColor.FgGreen}✓${colorReset}] ${changes.length} impact(s) found`);

    generateWebReport(changes)
}

module.exports = { onLatestVersion, getToken, getAllWithNextLink, callApi, generateWebReport, exportJSON, compare}