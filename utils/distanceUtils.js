 const toRadians = (degrees) => {
    return degrees * (Math.PI / 180);
}

 const calculateDistanceInMiles = (lat1, lon1, lat2, lon2) => {
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
module.exports = { calculateDistanceInMiles };
