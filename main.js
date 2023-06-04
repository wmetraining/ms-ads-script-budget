var MAX_COST = 1000 // Max allowed account cost for the month
let MYJSONBIN = {
  PASTEBIN_API: 'https://pastebin.com/api/api_post.php',
  api_dev_key: 'ENTER YOUR DEV KEY',
  api_user_key: 'ENTER YOUR USER KEY',
}
var SENDGRID_API_KEY = 'ENTER SENDGRID API KEY HERE IT SHOULD START WITH A SG.' // Get your own API key from https://sendgrid.com
var EMAIL_ADDRESS = 'ENTER EMAIL TO SEND TO' // Sends notifications to this email
var EMAIL_FROM = 'ENTER FROM EMAIL' // Sends notifications from this email

function main() {
    var account = AdsApp.currentAccount()
    var dataToStore = {}
    var accountId = account.getAccountId()
    var accountName = account.getName()
    var customerId = account.getCustomerId()
    var uniqueKey = accountId + "|" + customerId
    dataToStore.uniqueKey = uniqueKey

    // Re-Enable at Start of New Month (Day 1)
    var subject = "Account budget script made changes" // the subject line for the email
    var emailBody = "A Microsoft Ads Script has made changes to your account " + accountName + " (" + accountId + ")"

    var pausedCampaignIds = []
    var pausedCampaigns = []

    var now = new Date()
    var account = AdsApp.currentAccount()
    var formater = new Intl.DateTimeFormat('en-US', {
            day: '2-digit',
            
            timeZone: account.getTimeZone()
            })

    Logger.log(`Current day for ${account.getName()} in ${account.getTimeZone()} timezone: ${formater.format(now)}`)
    var thisDate = formater.format(now).toString().trim()
    var thisDateLen = thisDate.length
    thisDate = thisDate.replace(/\u200E/g, "")
    if(thisDate == '01'){
        Logger.log("first day")
        var savedState = jsonRead(MYJSONBIN)
        Logger.log(savedState)
        var uniqueKeyCheck = savedState.uniqueKey
        Logger.log("uniqueKeyCheck: " + uniqueKeyCheck)
        if(uniqueKey == uniqueKeyCheck) {
         emailBody += "\n Some campaigns were re-enabled because it's the start of a new month.\n Re-enabled campaigns:"
            var pausedCampaignIds = savedState.pausedCampaignIds
            Logger.log("pausedCampaignIds: " + pausedCampaignIds)
            var iterator = AdsApp.campaigns()
                        .withIds(pausedCampaignIds)
                        .get()
            while(iterator.hasNext()) {
                var campaign = iterator.next()
                campaign.enable()
                Logger.log("Re-enabled campaign: " + campaign.getName())
                emailBody += "\n  - " + campaign.getName()
            }
            //emailBody += "\n \n Try https://www.optmyzr.com for PPC Tools, Reports, Automations, Audits, and More."
            sendEmail(EMAIL_ADDRESS, EMAIL_FROM, subject, emailBody)
        } else {
            Logger.log("We couldn't determine what the script paused last month so please check your email from when the script last applied changes and manually enable all necessary campaigns.")
        }
    } else {
        //Logger.log("not first day")
    }

    // PAUSE IF COST EXCEEDS
    var emailBody = "A Bing Ads Script has made changes to your account " + accountName + " (" + accountId + ")"
    
    var totalCostThisMonth = 0 
    var pausedCampaignIds = []
    var pausedCampaigns = []

    // CAMPAIGN BUDGETS
    // Gets all campaigns in the account.
    var iterator = AdsApp.campaigns()
                    .forDateRange('THIS_MONTH')
                    .get()

    // Iterates through the list of campaigns and adds cost to total 
    while (iterator.hasNext()) {
        var campaign = iterator.next()
        var metrics = campaign.getStats()
        var cost = metrics.getCost()
        totalCostThisMonth += cost
        //Logger.log(`Campaign name:  ${campaign.getName()} | Cost: ${metrics.getCost()})`)
    }        

    Logger.log(`Cost so far this month: ${totalCostThisMonth}`)
    Logger.log("")
    dataToStore.costSoFarThisMonth = totalCostThisMonth
    

    if(totalCostThisMonth > MAX_COST) {
        emailBody += "\n The cost of your account for this month is " + totalCostThisMonth + ". This is more than your limit of " + MAX_COST + ".\n These campaigns were paused:"

        // Gets all active campaigns in the account
        var iterator = AdsApp.campaigns()
                    .withCondition("Status = ENABLED")
                    .forDateRange("THIS_MONTH")
                    .get()

        // Iterates through the list of campaigns and pauses them
        while (iterator.hasNext()) {
            var campaign = iterator.next()
            var campaignId = campaign.getId()
            var metrics = campaign.getStats()
            pausedCampaignIds.push(campaignId)            
            campaign.pause()
            emailBody += "\n  - " + campaign.getName()

            Logger.log(`Paused campaign:  ${campaign.getName()} | Cost: ${metrics.getCost()})`)
        } 
        //emailBody += "\n \n Try https://www.optmyzr.com for PPC Tools, Reports, Automations, Audits, and More."
        // Notifications and save state
        sendEmail(EMAIL_ADDRESS, EMAIL_FROM, subject, emailBody)
        dataToStore.pausedCampaignIds = pausedCampaignIds
        dataToStore.timePaused = new Date() 
        jsonWrite(dataToStore, MYJSONBIN)
        jsonRead(MYJSONBIN)
    }
}

function jsonWrite(dataToStore, myJsonBin) {
    Logger.log('Wrote')
    var options = {
        method:"post",
        payload: {
            'api_dev_key': MYJSONBIN.api_dev_key,
            'api_user_key': MYJSONBIN.api_user_key,
            'api_results_limit': '1',
            'api_option': 'list'
        },
    }
    var response = UrlFetchApp.fetch(MYJSONBIN.PASTEBIN_API, options)
    var responseText = response.getContentText()
    var pasteKeyRegex = /<paste_key>([^<]+)<\/paste_key>/
    var match = responseText.match(pasteKeyRegex)
    var pasteKey = match[1]
    deleteLastPaste(pasteKey)
    var options = {
        method:"post",
        payload: {
            'api_option': 'paste',
            'api_user_key': MYJSONBIN.api_user_key,
            'api_paste_private': '2',
            'api_dev_key': MYJSONBIN.api_dev_key,
            'api_paste_code': JSON.stringify(dataToStore)
        },
    }  

    var response = UrlFetchApp.fetch(MYJSONBIN.PASTEBIN_API, options)
    var responseText = response.getContentText()
    var responseCode = response.getResponseCode()
    Logger.log(responseText + " (" + responseCode + ")")
 
    return
    var tokens = JSON.parse(response.getContentText())
    var uri = tokens['uri']
    for(var key in tokens) {
        var val = tokens[key]
        Logger.log(key + " " + val)
    }
    Logger.log(uri)
}

function jsonRead() {
    Logger.log('Read')
    
    var options = {
        method:"post",
        payload: {
            'api_dev_key': MYJSONBIN.api_dev_key,
            'api_user_key': MYJSONBIN.api_user_key,
            'api_results_limit': '1',
            'api_option': 'list'
        },
    }
    var response = UrlFetchApp.fetch(MYJSONBIN.PASTEBIN_API, options)
    var responseText = response.getContentText()
    var pasteKeyRegex = /<paste_key>([^<]+)<\/paste_key>/
    var match = responseText.match(pasteKeyRegex)
    var pasteKey = match[1]
    var options = {
        method:"post",
        payload: {
            'api_option': 'show_paste',
            'api_dev_key': MYJSONBIN.api_dev_key,
            'api_user_key': MYJSONBIN.api_user_key,
            'api_paste_key': pasteKey
        },
    }   
    var response = UrlFetchApp.fetch(MYJSONBIN.PASTEBIN_API, options)
    var responseText = response.getContentText()

    var tokens = JSON.parse(response.getContentText())
    var uri = tokens['uri']
    for(var key in tokens) {
        var val = tokens[key]
        Logger.log(key + " " + val)
    }
    return(tokens)
}

function sendEmail(emailTo, emailFrom, subject, emailBody) {
    // Get your own SendGrid API Key from https://app.sendgrid.com/settings/api_keys
    var headers = {
        "Authorization" : "Bearer "+SENDGRID_API_KEY 
    }
    var email = {"personalizations": [{"to": [{"email": emailTo}]}],"from": {"email": emailFrom},"subject": subject,"content": [{"type": "text/plain", "value": emailBody}]}
    var options = {
    contentType: 'application/json',    
    'muteHttpExceptions': true, 
    'method':'post',
    'headers':headers,
    'payload':JSON.stringify(email)
  }
//Logger.log(JSON.stringify(options))
    var response = UrlFetchApp.fetch('https://api.sendgrid.com/v3/mail/send', options) 
    Logger.log(response.getContentText())
    Logger.log(response.getResponseCode())
}
function deleteLastPaste(pasteKey){
    Logger.log('Deleted')
    var options = {
        method:"post",
        payload: {
            'api_option': 'delete',
            'api_user_key': MYJSONBIN.api_user_key,
            'api_dev_key': MYJSONBIN.api_dev_key,
            'api_paste_key': pasteKey
        },
    }   
    var response = UrlFetchApp.fetch(MYJSONBIN.PASTEBIN_API, options)
}
