#!/usr/bin/env node

/*
======================================================================
Name: Conditional Access Impact Matrix
Description: This script helps solve a frequent problem: the lack of visibility of the exact Entra ID Conditional Access policies assigned to each user
Author: Jasper Baes (https://www.linkedin.com/in/jasper-baes/)
Published: January 20, 2023
Dependencies: axios, msal-node, fs, json-2-csv
======================================================================
*/

// version of the tool
global.currentVersion = '2024.49.1'

// Declare libaries
require('dotenv').config();
const axios = require('axios');
const msal = require('@azure/msal-node');
var fs = require('fs');
let converter = require('json-2-csv');
const helper = require('./helper');

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
    console.log(`\n${fgColor.FgCyan} ## Conditional Access Impact Matrix ## ${colorReset}${fgColor.FgGray}v${currentVersion}${colorReset}`);
    console.log(` ${fgColor.FgGray}Part of the Conditional Access Blueprint - https://jbaes.be/Conditional-Access-Blueprint${colorReset}`)
    console.log(` ${fgColor.FgGray}Created by Jasper Baes - https://github.com/jasperbaes/Conditional-Access-Matrix${colorReset}`)

    await helper.onLatestVersion()

    // set global variables
    global.tenantID = process.env.TENANTID
    global.clientSecret = process.env.CLIENTSECRET
    global.clientID = process.env.CLIENTID
    // global.thumbprint = process.env.THUMBPRINT  // still in development

    if (!global.tenantID || !global.clientID || !global.clientSecret) {
        console.error(' ERROR: check if global variable(s) are set in script.');
        process.exit(1);
    }    

    global.scriptParameters = process.argv

    let token = await helper.getToken() // get access token

    if (token) {
        console.log(`\n [${fgColor.FgGreen}✓${colorReset}] Connected to tenant '${tenantID}'`);
        calculate(token?.accessToken, tenantID)
    }   
}

init()

async function calculate(accessToken) {
    // Fetch conditional access policies and sort based on displayname
    console.log(` [${fgColor.FgGray}i${colorReset}] Fetching Conditional Access policies...`);

    let url = `/v1.0/policies/conditionalAccessPolicies?$filter=state eq 'enabled'`

    if (scriptParameters.some(param => ['--include-report-only'].includes(param.toLowerCase()))) {
        url = `/v1.0/policies/conditionalAccessPolicies?$filter=state eq 'enabled' or state eq 'enabledForReportingButNotEnforced'`
    }

    let conditionalAccessPolicies = await helper.getAllWithNextLink(accessToken, url)
    
    if (conditionalAccessPolicies == undefined) {
        console.log(' ERROR: could not get Conditional Access Polcies')
        process.exit()
    }

    console.log(` [${fgColor.FgGreen}✓${colorReset}] ${conditionalAccessPolicies.length} Conditional Access policies found`);

    conditionalAccessPolicies.sort((a, b) => {
        if (a.displayName < b.displayName) return -1;
        if (a.displayName > b.displayName) return 1;
        return 0;
    });

    // create seperate array with CA policy names only
    let conditionalAccessPoliciesNames = conditionalAccessPolicies?.map(policy => policy.displayName)

    // fetch all users in multiple api calls
    console.log(` [${fgColor.FgGray}i${colorReset}] Fetching users...`);
    let users = await helper.getAllWithNextLink(accessToken, `/beta/users?$select=userPrincipalName,displayName,jobTitle,id,accountEnabled,userType`) 

    console.log(` [${fgColor.FgGreen}✓${colorReset}] ${users.length} users found`);

     // type parameter
     const typeIndex = scriptParameters.findIndex(param => ['-t', '--type'].includes(param.toLowerCase()));
     if (typeIndex !== -1 && typeIndex + 1 < scriptParameters.length) {
        const typeValue = scriptParameters[typeIndex + 1];
         
        if (typeValue == 'member' || typeValue == 'Member' || typeValue == 'members' || typeValue == 'Members') {
            users = users.filter(user => user.userType == 'Member')
        } else if (typeValue == 'guest' || typeValue == 'Guest' || typeValue == 'guests' || typeValue == 'Guests') {
            users = users.filter(user => user.userType == 'Guest')
        } else {
            console.log(` ERROR: parameter -t or --type ${typeValue} should be 'member' or 'guest'`)
            process.exit()
        }

        console.log(` [${fgColor.FgGreen}✓${colorReset}] Limiting user scope to the ${users.length} ${typeValue} users`);
     }

    // limit parameter
    const limitIndex = scriptParameters.findIndex(param => ['-l', '--limit'].includes(param.toLowerCase()));
    if (limitIndex !== -1 && limitIndex + 1 < scriptParameters.length) {
        const limitValue = scriptParameters[limitIndex + 1];
        users = users.slice(0,limitValue)
        console.log(` [${fgColor.FgGreen}✓${colorReset}] Limiting user scope to first ${limitValue} users`);
    }

    console.log(` [${fgColor.FgGray}i${colorReset}] Generating matrix...`);

    const totalUsers = users.length;
    
    // loop through all users
    // For each CA policy, checks if user is included/excluded directly in CA policy or is member of an included/excluded group in CA policy
    resultObj = []
    for (let [index, user] of users.entries()) {
        let groups = []        
        groups = await helper.getAllWithNextLink(accessToken, `/v1.0/users/${user.id}/memberOf?$select=id`)
        let groupList = groups?.map(group => group.id)

        // Log progress
        const progress = ((index + 1) / totalUsers) * 100; // Calculate progress percentage
        process.stdout.clearLine(); // Clear previous progress percentage
        process.stdout.cursorTo(0); // Move cursor to start of line
        process.stdout.write(` [${fgColor.FgGray}i${colorReset}] Progress: ${progress.toFixed(2)}% (${totalUsers - (index + 1)} user(s) remaining)`); // Display progress percentage

         // group parameter
         const groupIndex = scriptParameters.findIndex(param => ['-g', '--group'].includes(param.toLowerCase()));
         if (groupIndex !== -1 && groupIndex + 1 < scriptParameters.length) {
             const groupValue = scriptParameters[groupIndex + 1];
             // skip current for loop if parameter group ID is not in current user group list
             if (!groupList.includes(groupValue)) continue
         }

        resultObj.push({
            user: user.displayName?.replace(',', '').replace(';', ''), 
            upn: user.userPrincipalName?.replace(',', ''), 
            job: user?.jobTitle?.replace(',', '').replace(';', ''),
            external: user.userPrincipalName?.includes('#EXT#@'),
            enabled: user?.accountEnabled
        })

        for (let policy of conditionalAccessPolicies) {
            resultObj.filter(x => x.upn == user.userPrincipalName)[0][policy.displayName] = await calculateIncluded(policy, user, groupList, accessToken)
        }
    }

    process.stdout.write(`\n`)
    console.log(` [${fgColor.FgGreen}✓${colorReset}] ${resultObj.length} users processed`);

    // CSV convert and JSON export
    try {
        const csv = await converter.json2csv(resultObj);    
    
        const today = new Date().toISOString().slice(0, 10); // Get today's date in YYYY-MM-DD format
        const filename = `${today}-CA-Impact-Matrix.csv`;
    
        fs.writeFile(filename, csv, err => {
            if (err) return console.log(err);
            console.log(` [${fgColor.FgGreen}✓${colorReset}] '${filename}' saved in current directory`);
        });

         // export to JSON
        if (!scriptParameters.some(param => ['--compare'].includes(param.toLowerCase()))) {
            await helper.exportJSON(resultObj, `${today}-CA-Impact-Matrix.json`) 
        }

    } catch (error) {
        console.log(` [${fgColor.FgRed}X${colorReset}] ${fgColor.FgRed}ERROR${colorReset}: Something went wrong converting to CSV or saving in the current directory`);
        console.log(`\n ${error} \n`)
    }

    // Compare
    try {
        if (scriptParameters.some(param => ['--compare'].includes(param.toLowerCase()))) {
            const indexO = process.argv.indexOf('--compare');
            if (indexO !== -1 && indexO < process.argv.length - 1) {
                const parameterAfterO = process.argv[indexO + 1];
                console.log(` [${fgColor.FgGray}i${colorReset}] Comparing with ${parameterAfterO}...`);
                const fileContent = await JSON.parse(await fs.readFileSync(`./${parameterAfterO}`, 'utf-8'))
                await helper.compare(fileContent, resultObj)
            }
        } 
    } catch (error) {
        console.log(` [${fgColor.FgRed}X${colorReset}] ${fgColor.FgRed}ERROR${colorReset}: Could not compare. Check if the file exists in this current directory`);
        console.log(`\n ${error} \n`)
    }
}

// this function returns if a given user is included or excluded from a given Condittional Access policy
async function calculateIncluded(policy, user, groupList, accessToken) {
    // check if user is directly excluded in policy
    if (policy.conditions.users.excludeUsers.includes(user.id)) return false

    // check if user is member of excluded group in policy
    let excludedGroups = policy.conditions.users.excludeGroups
    let excludedGroupsRecursive = await calculateSubgroupsRecursive(excludedGroups, accessToken)
    if (checkArrays(groupList, excludedGroupsRecursive) == true) return false

    // check if all users are included
    if (policy.conditions.users.includeUsers.includes('All')) return true

    // check if user is directly included or excluded in policy
    if (policy.conditions.users.includeUsers.includes(user.id)) return true

    // check if user is member of a group included
    let includedGroups = policy.conditions.users.includeGroups
    let includedGroupsRecursive = await calculateSubgroupsRecursive(includedGroups, accessToken)  
    if (checkArrays(groupList, includedGroupsRecursive) == true) return true

    return false
}

    // This function returns all subgroups of a given group recursively, including the given group itself.
    async function calculateSubgroupsRecursive(groupIds, accessToken) {
        const subgroups = new Set();

        for (const groupId of groupIds) {
            await fetchSubgroups(groupId, accessToken, subgroups);
        }
        
        return Array.from(subgroups);
    }

    // This function returns and adds to the subgroups Set() with all recursive subgroups of a given group
    async function fetchSubgroups(groupId, accessToken, subgroups) {
        // Add the current group to the set
        subgroups.add(groupId);

        // Fetch transitive members of the group
        const response = await helper.getAllWithNextLink(accessToken, `/v1.0/groups/${groupId}/transitiveMembers?$select=id`)

        // Iterate through the members and recursively fetch subgroups if they are groups
        for (const member of response) {
            if (member['@odata.type'] === '#microsoft.graph.group') {
                await fetchSubgroups(member.id, accessToken, subgroups);
            }
        }
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

