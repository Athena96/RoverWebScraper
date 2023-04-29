const puppeteer = require("puppeteer");
const fs = require("fs");

const jsdom = require("jsdom");
const { JSDOM } = jsdom;

let sittersMap = new Map();

function writeFile(filename, content) {
  try {
    fs.writeFileSync(filename, content);
    console.log(`The file ${filename} has been saved!`);
  } catch (err) {
    console.error(err);
  }
}

function createCSV() {
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
    const url = `https://www.rover.com/members/${urlsuffix}`;
    csvString += `${sitter["shortName"]},${url},$${price.toFixed(
      2
    )},${distanceInMiles},${reviewsCount}, ${ratingsAverage}, ${yearsOfExperience}, ${repeatClientCount}\n`;
  }

  const dt = new Date().getTime();
  const file_name = `${dt}_sitters.csv`;
  console.log(`wrote csv to file: ${file_name}`);

  writeFile(file_name, csvString);
}

function extractFields(sitter) {
  const price = Number(sitter["price"]);

  const lat = Number(sitter["latitude"]);
  const lng = Number(sitter["longitude"]);
  const distanceInMiles = calculateDistanceInMiles(lat, lng, 47.71960627201266, -122.31902470107437);

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistanceInMiles(lat1, lon1, lat2, lon2) {
  const earthRadiusMiles = 3958.8; // Earth's radius in miles

  // Convert latitudes and longitudes to radians
  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const lat2Rad = toRadians(lat2);
  const lon2Rad = toRadians(lon2);

  // Calculate the differences between the latitudes and longitudes
  const deltaLat = lat2Rad - lat1Rad;
  const deltaLon = lon2Rad - lon1Rad;

  // Use the Haversine formula to calculate the great-circle distance between the two points
  const a =
    Math.pow(Math.sin(deltaLat / 2), 2) + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.pow(Math.sin(deltaLon / 2), 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMiles = earthRadiusMiles * c;

  return distanceMiles;
}

async function downloadSitterData(browser, page_idx) {
  const page = await browser.newPage();

  const url = `https://www.rover.com/search/?alternate_results=true&accepts_only_one_client=false&apse=false&bathing_grooming=false&cat_care=false&centerlat=47.65382025990875&centerlng=-122.3385&dogs_allowed_on_bed=false&dogs_allowed_on_furniture=false&end_date=05%2F06%2F2023&frequency=onetime&morning_availability=false&midday_availability=false&evening_availability=false&fulltime_availability=true&monday=false&tuesday=false&wednesday=false&thursday=false&friday=false&saturday=false&sunday=false&giant_dogs=false&has_fenced_yard=false&has_house=false&has_no_children=false&is_initial_search=false&is_premier=false&knows_first_aid=false&large_dogs=true&location=Seattle%2C%20WA%2098125%2C%20USA&location_accuracy=5161&maxlat=47.75870907539852&maxlng=-122.24425790405273&medium_dogs=false&minlat=47.5487203398201&minlng=-122.43274209594726&minprice=1&no_caged_pets=false&no_cats=false&no_children_0_5=false&no_children_6_12=false&non_smoking=false&page=${page_idx}&person_does_not_have_dogs=false&pet=&petsitusa=false&pet_type=dog&puppy=false&raw_location_types=postal_code&service_type=overnight-traveling&small_dogs=false&start_date=05%2F04%2F2023&search_score_debug=false&injected_medication=false&special_needs=false&oral_medication=false&more_than_one_client=false&uncrated_dogs=false&unspayed_females=false&non_neutered_males=false&females_in_heat=false&unactivated_provider=false&premier_matching=false&premier_or_rover_match=false&is_member_of_sitter_to_sitter=false&is_member_of_sitter_to_sitter_plus=false&location_type=zip-code&dog_size=large&zoomlevel=12`;
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

function getProbabilityOfGirlsName(name) {
    const url = `https://api.genderize.io?name=${name}`;
    return fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.gender === 'female') {
          return data.probability;
        } else {
          return 1 - data.probability;
        }
      })
      .catch(error => {
        console.error(error);
        return null;
      });
  }

  
function checkMeetsCriteria(sitter) {
  const MAX_PRICE = 127
  const MAX_DIST = 15;
  const MIN_REVIEWS = 12;
  const MIN_RATING_AVG = 4.5;
  const MIN_YEARS_OF_EXP = 2;
  const MIN_REPEAT_CLIENT_COUNT = 5;

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

function randomSleep() {
  return Math.floor(Math.random() * 2001) + 2000;
}


async function main() {
  console.log(`STARTING`);

  const MAX_PAGE = 25;

  let page_idx = 1;

  // start browser
  const browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36",
  });

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
        const url = `https://www.rover.com/members/${urlsuffix}`;
        console.log(`[FAILED CRITERIA] Skipping ${sitter["shortName"]}: ${url}`);
      }
    }

    page_idx += 1;

    const sleepPeriod = randomSleep();
    console.log(`Sleeping for ${sleepPeriod/1000.0} seconds...`);
    await sleep(sleepPeriod);
  }

  // close browser
  console.log("Done scraping, closing browser..");
  await browser.close();

  console.log("Writing to CSV...");
  createCSV();

  console.log(`DONE!`);
}

main().catch((err) => {
  console.log("ERROR IN SCRIPT... saving data");
  console.log(err);
  puppeteer.close();
  createCSV();
});
