const ALPHANUMERIC_LOWER = "abcdefghijklmnopqrstuvwxyz0123456789";
const ALPHANUMERIC_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ALPHANUMERIC_MIXED = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ALPHANUMERIC_MIXED_SYMBOLS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
const DEFAULT_CHARACTER_SET = "alphanumeric_mixed";
const DEFAULT_PASSWORD_LENGTH = 12;
const MINIMUM_PASSWORD_LENGTH = 10;
const CHARACTER_SETS = {
    alphanumeric_lower: ALPHANUMERIC_LOWER,
    alphanumeric_upper: ALPHANUMERIC_UPPER,
    alphanumeric_mixed: ALPHANUMERIC_MIXED,
    alphanumeric_mixed_symbols: ALPHANUMERIC_MIXED_SYMBOLS
};
const CURRENT_VERSION = "1.0.0";

/**
 * This function takes an input string in snakecase and converts it to the
 * camel case generally used by Javascript.
 */
function camelCaseString(inputText) {
    return(inputText.split("_")
        .map((word, index) => {
            if(index > 0) {
                return(`${word.charAt(0).toUpperCase()}${word.slice(1)}`);
            } else {
                return(word);
            }
        })
        .join(""));
}

/**
 * This function fetches details of the current client application from the
 * Plauzible server. The response is a JSON object with version and url
 * properties. The version property is the current latest version of the
 * client application. The URL represents the URL where the current client
 * application can be downloaded.
 */
function fetchApplicationVersionDetails(settings) {
    return fetch(`${settings.serviceURL}/api/client/version`)
        .then((response) => response.json())
        .catch((error) => {
            console.error("Failed to check application version.Cause:", error);
        });
}


function showError(message) {
    console.error("ERROR:", message);
    new Notify({
        autotimeout: 10000,
        status: "error",
        text: message,
        title: "Error"
    });
}

function showInfo(message) {
    new Notify({
        autotimeout: 10000,
        status: "info",
        text: message,
        title: "Information"
    });
}

function showSuccess(message) {
    new Notify({
        status: "success",
        text: message,
        title: "Success"
    });
}

function watchClassList(element, callback) {
    if (!element) {
        console.error("Cannot watch class list of null element");
        return null;
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                callback(element.classList);
            }
        });
    });

    observer.observe(element, {
        attributes: true,
        attributeFilter: ['class']
    });

    return observer;
}

function watchSpecificClass(element, className, callback) {
    if (!element) {
        console.error("Cannot watch class of null element");
        return null;
    }

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const hasClass = element.classList.contains(className);
                callback(hasClass);
            }
        });
    });

    observer.observe(element, {
        attributes: true,
        attributeFilter: ['class']
    });

    return observer;
}

function uniqueAndSortStringList(array) {
    let object = {};

    array.forEach((item) => {
        object[item] = true;
    });

    return Object.keys(object).filter((entry) => entry.trim() !== "").sort((a, b) => a.localeCompare(b, 'en', {'sensitivity': 'base'}));
}

export {
    ALPHANUMERIC_LOWER,
    ALPHANUMERIC_UPPER,
    ALPHANUMERIC_MIXED,
    ALPHANUMERIC_MIXED_SYMBOLS,
    CHARACTER_SETS,
    CURRENT_VERSION,
    DEFAULT_CHARACTER_SET,
    DEFAULT_PASSWORD_LENGTH,
    MINIMUM_PASSWORD_LENGTH,
    camelCaseString,
    fetchApplicationVersionDetails,
    showError,
    showInfo,
    showSuccess,
    watchClassList,
    watchSpecificClass,
    uniqueAndSortStringList
};