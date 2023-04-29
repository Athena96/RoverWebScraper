const config = require('./criteria.json');
const puppeteer = require("puppeteer");
const jsdom = require("jsdom");
const { writeFile } = require('./utils/fileIO.js');
const { calculateDistanceInMiles } = require('./utils/distanceUtils.js');

const { JSDOM } = jsdom;

const ROVER_URL_PREFIX = `https://www.rover.com`;

let sittersMap = new Map();

const writeSitterDataToCSV = () => {
  // Create CSV
  let csvString =
    "Name, url, price, distanceInMiles, reviewsCount, ratingsAverage, yearsOfExperience, repeatClientCount\n";
  for (const sitter of sittersMap.values()) {
    const {
      price,
      distanceInMiles,
      reviewsCount,
      ratingsAverage,
      browsableServiceSlugs,
      yearsOfExperience,
      repeatClientCount,
    } = extractFields(sitter);

    const urlsuffix = sitter["webUrl"].split("https:www.rover.commembers")[1];
    const url = `${ROVER_URL_PREFIX}/members/${urlsuffix}`;
    csvString += `${sitter["shortName"]},${url},$${price.toFixed(
      2
    )},${distanceInMiles},${reviewsCount}, ${ratingsAverage}, ${yearsOfExperience}, ${repeatClientCount}\n`;
  }

  const dt = new Date().getTime();
  const file_name = `${dt}_sitters.csv`;
  console.log(`wrote csv to file: ${file_name}`);

  writeFile(file_name, csvString);
}

const extractFields = (sitter) => {
  const price = Number(sitter["price"]);
  const lat = Number(sitter["latitude"]);
  const lng = Number(sitter["longitude"]);
  const distanceInMiles = calculateDistanceInMiles(lat, lng, config.custom_queries.my_lat, config.custom_queries.my_lon);
  const reviewsCount = Number(sitter["reviewsCount"]);
  const ratingsAverage = Number(sitter["ratingsAverage"]);
  const browsableServiceSlugs = sitter["browsableServiceSlugs"];
  const yearsOfExperience = Number(sitter["yearsOfExperience"].split(" ")[0]);
  const repeatClientCount = Number(sitter["providerProfile"]["repeatClientCount"]);
  return {
    price,
    distanceInMiles,
    reviewsCount,
    ratingsAverage,
    browsableServiceSlugs,
    yearsOfExperience,
    repeatClientCount,
  };
}

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const downloadSitterData = async (browser, page_idx) => {
  const page = await browser.newPage();
  const url = buildRoverURL(config, page_idx);
  console.log(`url: ${url}`);
  await page.goto(url);

  const pageContent = await page.content();
  const dom = new JSDOM(pageContent).window.document;
  const scriptTag = Array.from(dom.querySelectorAll("script")).find((tag) =>
    tag.textContent.includes("window.__ROVER_INITIAL_DATA__")
  );

  // Extract the content of the script tag
  const scriptContent = scriptTag ? scriptTag.textContent : null;
  const jsonContent1 = scriptContent.replace(/\\u002F/g, "");
  const jsonContent2 = jsonContent1.replace("window.__ROVER_INITIAL_DATA__ = ", "");
  const jsonContent3 = jsonContent2.replace("};", "}");
  const jsonContent4 = jsonContent3.replace(/undefined/g, '""');
  const jsonContent5 = jsonContent4.replace(/new Date\(/g, "");
  const jsonContent6 = jsonContent5.replace(/\"\),/g, '",');
  const data = JSON.parse(jsonContent6);
  const sitters = data["search"]["fetchSearchResponse"]["results"];
  return sitters;
}

const checkMeetsCriteria = (sitter) => {
  const MAX_PRICE = config.custom_queries.max_price
  const MAX_DIST = config.custom_queries.max_distance_from_me
  const MIN_REVIEWS = config.custom_queries.min_reviews
  const MIN_RATING_AVG = config.custom_queries.min_rating_avg
  const MIN_YEARS_OF_EXP = config.custom_queries.min_years_experience
  const MIN_REPEAT_CLIENT_COUNT = config.custom_queries.min_repeat_client_count

  const {
    price,
    distanceInMiles,
    reviewsCount,
    ratingsAverage,
    browsableServiceSlugs,
    yearsOfExperience,
    repeatClientCount,
  } = extractFields(sitter);

  // in price range
  if (price > MAX_PRICE) {
    return false;
  }

  // in distance range
  if (distanceInMiles > MAX_DIST) {
    return false;
  }

  // has at least X reviews
  if (reviewsCount < MIN_REVIEWS) {
    return false;
  }

  // ratingsAverage >= x
  if (ratingsAverage < MIN_RATING_AVG) {
    return false;
  }

  // repeatClientCount >= x
  if (repeatClientCount < MIN_REPEAT_CLIENT_COUNT) {
    return false;
  }

  // browsableServiceSlugs has overnight-traveling
  if (!browsableServiceSlugs.includes("overnight-traveling")) {
    return false;
  }

  // primaryBadgeData slug: 'verified-enhanced-background-check'
  if (
    sitter["primaryBadgeData"] &&
    sitter["primaryBadgeData"]["slug"] &&
    sitter["primaryBadgeData"]["slug"] != "verified-enhanced-background-check"
  ) {
    return false;
  }

  if (yearsOfExperience < MIN_YEARS_OF_EXP) {
    return false;
  }

  return true;
}

const randomSleepPeriod = () => {
  return Math.floor(Math.random() * 2001) + 2000;
}

const buildRoverURL = (config, pageIdx) => {
  let url = `${ROVER_URL_PREFIX}/search/?page=${pageIdx}`
  for (const [key, value] of Object.entries(config.url_queries)) {
    const encoded = typeof value === 'string' ? encodeURIComponent(value) : value
    url += `${key}=${encoded}&`
  }
  return url
}

const main = async () => {
  console.log(`Starting script...`);

  const MAX_PAGE = config.script_settings.pages_to_search
  let page_idx = 1;

  // start browser
  const browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36",
  });

  // scrap the data
  console.log(`Scraping ${MAX_PAGE} page(s) of dog sitters...`);
  while (page_idx <= MAX_PAGE) {
    console.log(`Browsing Page # ${page_idx}`);

    const sitters = await downloadSitterData(browser, page_idx);
    console.log(`Found ${sitters.length} sitters`);

    for (const sitter of sitters) {
      const key = sitter["personOpk"];
      const meetsCriteria = checkMeetsCriteria(sitter);

      if (sittersMap.has(key)) {
        console.log(`[SEEN] Skipping ${sitter["shortName"]}, already seen`);
        continue;
      }

      if (meetsCriteria) {
        sittersMap.set(key, sitter);
        console.log(`[ADDED] ${sitter["shortName"]} to list, current count: ${sittersMap.size}`);
      } else {
        const urlsuffix = sitter["webUrl"].split("https:www.rover.commembers")[1];
        const url = `${ROVER_URL_PREFIX}/members/${urlsuffix}`;
        console.log(`[FAILED CRITERIA] Skipping ${sitter["shortName"]}: ${url}`);
      }
    }

    page_idx += 1;

    // random sleep time so we don't get caught as a robot! :)
    const sleepPeriod = randomSleepPeriod();
    console.log(`Sleeping for ${sleepPeriod / 1000.0} seconds...`);
    await sleep(sleepPeriod);
  }

  // close browser
  console.log("Done scraping, closing browser..");
  await browser.close();

  // write data to disk
  writeSitterDataToCSV()
  console.log(`Done.`);
}

main().catch((err) => {
  console.log("ERROR IN SCRIPT... saving data");
  console.log(err);
  puppeteer.close();
  writeSitterDataToCSV()
});
