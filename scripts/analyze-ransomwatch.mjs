// Script to analyze ransomwatch data and find recent entries
import https from 'https'

const url = 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json'

https.get(url, (res) => {
  let data = ''
  res.on('data', chunk => data += chunk)
  res.on('end', () => {
    const posts = JSON.parse(data)
    console.log(`Total posts: ${posts.length}`)

    // Parse dates and find most recent
    const withDates = posts.map(p => {
      // Try to parse the discovered date
      let date = null
      if (p.discovered) {
        // Format is "YYYY-MM-DD HH:MM:SS.ffffff"
        const cleaned = p.discovered.replace(' ', 'T').split('.')[0]
        date = new Date(cleaned)
      }
      return { ...p, parsedDate: date }
    }).filter(p => p.parsedDate && !isNaN(p.parsedDate.getTime()))

    console.log(`Posts with valid dates: ${withDates.length}`)

    // Sort by date descending
    withDates.sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime())

    // Show 10 most recent
    console.log('\n10 MOST RECENT POSTS:')
    withDates.slice(0, 10).forEach((p, i) => {
      console.log(`${i + 1}. ${p.discovered} - ${p.group_name} - ${p.post_title?.slice(0, 40)}...`)
    })

    // Count posts in different time ranges
    const now = new Date()
    const last24h = new Date(now - 24 * 60 * 60 * 1000)
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const last30d = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const last90d = new Date(now - 90 * 24 * 60 * 60 * 1000)

    const counts = {
      last24h: withDates.filter(p => p.parsedDate >= last24h).length,
      last7d: withDates.filter(p => p.parsedDate >= last7d).length,
      last30d: withDates.filter(p => p.parsedDate >= last30d).length,
      last90d: withDates.filter(p => p.parsedDate >= last90d).length,
    }

    console.log('\nPOSTS BY TIME RANGE:')
    console.log(`Last 24 hours: ${counts.last24h}`)
    console.log(`Last 7 days: ${counts.last7d}`)
    console.log(`Last 30 days: ${counts.last30d}`)
    console.log(`Last 90 days: ${counts.last90d}`)

    // Show date range
    const oldest = withDates[withDates.length - 1]
    const newest = withDates[0]
    console.log(`\nDate range: ${oldest?.discovered} to ${newest?.discovered}`)
  })
}).on('error', console.error)
