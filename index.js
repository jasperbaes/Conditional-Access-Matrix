#!/usr/bin/env node

/*
======================================================================
Name: Conditional Access User Matrix
Description: This script helps solve a frequent problem: the lack of visibility of the exact Entra ID Conditional Access policies assigned to each user
Author: Jasper Baes (https://www.linkedin.com/in/jasper-baes/)
Published: January 20, 2023
Dependencies: axios, msal-node, fs, json-2-csv
======================================================================
*/

// version of the tool
global.currentVersion = '2024.15'

// Declare libaries
require('dotenv').config();
const axios = require('axios');
const msal = require('@azure/msal-node');
var fs = require('fs');
let converter = require('json-2-csv');

global.fgColor = {
    FgRed: "\x1b[31m",
    FgGreen: "\x1b[32m",
    FgYellow: "\x1b[33m",
    FgBlue: "\x1b[34m",
    FgMagenta: "\x1b[35m",
    FgCyan: "\x1b[36m",
    FgGray: "\x1b[90m",
}
global.colorReset = "\x1b[0m"

async function init() {
    console.log(`\n${fgColor.FgCyan} ## Conditional Access Matrix ## ${colorReset}${fgColor.FgGray}v${currentVersion}${colorReset}`);
    console.log(` ${fgColor.FgGray}Created by Jasper Baes - https://github.com/jasperbaes/Conditional-Access-User-Matrix${colorReset}`)

    await onLatestVersion()

    // set global variables
    global.tenantID = process.env.TENANTID
    global.clientSecret = process.env.CLIENTSECRET
    global.clientID = process.env.CLIENTID


    if (global.tenantID.length <= 0 || global.clientID.length <= 0 || global.clientSecret.length <= 0) {
        console.error(' ERROR: check if global variable(s) are set in script.')
        process.exit()
    }

    let token = await getToken() // get access token

    if (token) {
        calculate(token?.accessToken, tenantID)
    }   
}

init()

async function calculate(accessToken) {
    // Fetch conditional access policies and sort based on displayname
    console.log(`\n Fetching Conditional Access policies...`)
    let conditionalAccessPolicies = await getAllWithNextLink(accessToken, `/v1.0/policies/conditionalAccessPolicies?$filter=state eq 'enabled'`)
    
    if (conditionalAccessPolicies == undefined) {
        console.log(' ERROR: could not get Conditional Access Polcies')
        process.exit()
    }

    console.log(` ${conditionalAccessPolicies.length} Conditional Access policies found\n`)

    conditionalAccessPolicies.sort((a, b) => {
        if (a.displayName < b.displayName) return -1;
        if (a.displayName > b.displayName) return 1;
        return 0;
    });

    // create seperate array with CA policy names only
    let conditionalAccessPoliciesNames = conditionalAccessPolicies?.map(policy => policy.displayName)

    // fetch all users in multiple api calls
    console.log(' Fetching users...')
    let users = await getAllWithNextLink(accessToken, `/beta/users?$select=userPrincipalName,displayName,jobTitle,id,accountEnabled`) 

    console.log(` ${users.length} users found. Generating matrix...\n`)

    // users = users.slice(0,10) // de-comment this to run for the first X users
    const totalUsers = users.length;
    
    // loop through all users
    // For each CA policy, checks if user is included/excluded directly in CA policy or is member of an included/excluded group in CA policy
    resultObj = []
    for (let [index, user] of users.entries()) {
        let groups = []        
        groups = await callApi(`https://graph.microsoft.com/v1.0/users/${user.id}/memberOf?$select=id`, accessToken, tenantID)
        let groupList = groups?.value.map(group => group.id)

        // Log progress
        const progress = ((index + 1) / totalUsers) * 100; // Calculate progress percentage
        process.stdout.clearLine(); // Clear previous progress percentage
        process.stdout.cursorTo(0); // Move cursor to start of line
        process.stdout.write(` Progress: ${progress.toFixed(2)}% (${totalUsers - (index + 1)} user(s) remaining)`); // Display progress percentage

        resultObj.push({
            user: user.displayName?.replace(',', '').replace(';', ''), 
            upn: user.userPrincipalName?.replace(',', ''), 
            job: user?.jobTitle?.replace(',', '').replace(';', ''),
            external: user.userPrincipalName?.includes('#EXT#@'),
            enabled: user?.accountEnabled
        })

        for (let policy of conditionalAccessPolicies) {
            resultObj.filter(x => x.upn == user.userPrincipalName)[0][policy.displayName] = await calculateIncluded(policy, user, groupList)
        }
    }

    console.log('\n\n Converting to CSV...')

    try {
        const csv = await converter.json2csv(resultObj);    
        console.log(' Successfully converted to CSV')
    
        const today = new Date().toISOString().slice(0, 10); // Get today's date in YYYY-MM-DD format
        const filename = `${today}_ConditionalAccessMatrix.csv`;
    
        fs.writeFile(filename, csv, err => {
            if (err) return console.log(err);
            console.log(` File '${filename}' successfully saved in current directory`);
            process.exit()
        });
    } catch (error) {
        console.log(' Error converting to CSV or saving to folder.')
    }
}

async function calculateIncluded(policy, user, groupList) {
    // check if user is directly excluded in policy
    if (policy.conditions.users.excludeUsers.includes(user.id)) return false

    // check if user is member of excluded group in policy
    let excludedGroups = policy.conditions.users.excludeGroups
    if (checkArrays(groupList, excludedGroups) == true) return false

    // check if all users are included
    if (policy.conditions.users.includeUsers.includes('All')) return true

    // check if user is directly included or excluded in policy
    if (policy.conditions.users.includeUsers.includes(user.id)) return true

    // check if user is member of a group included
    let includedGroups = policy.conditions.users.includeGroups
    if (checkArrays(groupList, includedGroups) == true) return true

    return false
}

function checkArrays(arr1, arr2) {
    for (let i = 0; i < arr1?.length; i++) {
        if (arr2?.indexOf(arr1[i]) !== -1) {
            return true;
        }
    }
    for (let i = 0; i < arr2?.length; i++) {
        if (arr1?.indexOf(arr2[i]) !== -1) {
            return true;
        }
    }
    return false;
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
        console.error(' ERROR: error while retrieving access token. Please check the script variables and permissions!\n\n', error)
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
    const options = {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    };

    try {
        const response = await axios.default.get(endpoint, options);
        return response.data;
    } catch (error) {
        console.error(' ERROR: error while fetching from Graph API. Please check the script variables and permissions!\n')
        process.exit()
    }
};

async function onLatestVersion() {
    // this function shows a message if the version of the tool equals the latest uploaded version in Github
    try {
        // fetch latest version from Github
        const response = await axios.default.get('https://raw.githubusercontent.com/jasperbaes/Conditional-Access-User-Matrix/main/assets/latestVersion.json');
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