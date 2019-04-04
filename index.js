//
// JIRA completion source
// To configure, addjust your $VIMHOME/coc-settings.json:
//
// {
//     "coc.source.jira.filename": "/home/username/.cache/jira/jira.candidates.tsv"
// }

const { sources, workspace } = require('coc.nvim')
const path = require('path')
const fs = require('fs')
const util = require('util')

let words = []
let dates = []

function getMinMaxDate(dateStrings) {
    var minDate = new Date(dateStrings[0])
    var maxDate = new Date(dateStrings[0])

    for (let dateString of dateStrings) {
        let parsed = new Date(dateString)
        if (parsed > maxDate) {
            maxDate = parsed
        }
        if (parsed < minDate) {
            minDate = parsed
        }
    }
    return [minDate, maxDate]
}

function reverseDate(date, minDate, maxDate) {
    var result
    if (date) {
        let parsed = new Date(date)
        let offset = parsed.getTime() - minDate.getTime()
        result = new Date(maxDate.getTime() - offset)
    } else {
        result = maxDate
    }
    return result.toISOString().slice(0, 10)
}

function getCandadatesFilename() {
  let config = workspace.getConfiguration('coc.source.jira')
  return config.get('filename', null)
}

async function readCandidates() {
    words = []
    dates = []
    const filename = getCandadatesFilename()
    let file = path.resolve(filename)
    if (!fs.existsSync(filename)) {
        workspace.showMessage('No such file: ' + filename, 'error')
        return
    }

    const readFile = util.promisify(fs.readFile)
    const content = await readFile(file, 'utf8')
    // , (err, content) => {
    // if (err) return
    words = content.split(/\n/)
    var dateStrings = []
    words = words.map(line => {
        let parts = line.split('\t')
        dateStrings.push(parts[4])
        return {
            ticket: parts[0],
            title: parts[1] ? '' + parts[1] : '<NA>',
            last_updated: parts[4],
        }
    })
    var [minDate, maxDate] = getMinMaxDate(dateStrings)
    dates.push(minDate)
    dates.push(maxDate)
}

exports.activate = async context => {
    context.subscriptions.push(sources.createSource({
        name: 'jira',
        triggerCharacters: ['J'],
        doComplete: async function (opt) {
            let trigger = 'JI'
            if (!opt.input) return null
            if (!opt.input.startsWith(trigger)) return null
            await readCandidates()

            // if (!/^[A-Za-z]{1,}$/.test(opt.input)) return null
            // if (opt.triggerCharacter != 'J') return null
            let lengths = words.map(item => item.ticket.length)
            let max_len = Math.max(...lengths)
            let trim_after = 80
            let trim_character = '…'
            return {
                items: words.map(item => {
                    let padding = ' '.repeat(max_len - item.ticket.length)
                    let ticket = `${padding}${item.ticket}`
                    let title_len = String(item.title).length
                    let title = item.title
                    if (title_len > trim_after) {
                        title = title.slice(0, trim_after) + trim_character
                    }
                    let lastUpdatedReversed = reverseDate(item.last_updated, dates[0], dates[1])
                    return {
                        word: `${item.ticket}`,
                        filterText: `${trigger}${item.title}`,
                        sortText: `${trigger}${lastUpdatedReversed}${item.title}`,
                        abbr: `${ticket} ${title}`,
                        menu: this.menu
                    }
                })
            }
        }
    }))
}
