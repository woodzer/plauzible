const ALPHANUMERIC_LOWER = "abcdefghijklmnopqrstuvwxyz0123456789";
const ALPHANUMERIC_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ALPHANUMERIC_MIXED = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ALPHANUMERIC_MIXED_SYMBOLS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
const DEFAULT_CHARACTER_SET = "alphanumeric_mixed";
const DEFAULT_PASSWORD_LENGTH = 12;
const CHARACTER_SETS = {
    alphanumeric_lower: ALPHANUMERIC_LOWER,
    alphanumeric_upper: ALPHANUMERIC_UPPER,
    alphanumeric_mixed: ALPHANUMERIC_MIXED,
    alphanumeric_mixed_symbols: ALPHANUMERIC_MIXED_SYMBOLS
};

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


function showError(message) {
    console.error("ERROR:", message);
    new Notify({
        autotimeout: 10000,
        status: "error",
        text: message,
        title: "Error"
    });
}

function showSuccess(message) {
    new Notify({
        status: "success",
        text: message,
        title: "Success"
    });
}

export {
    ALPHANUMERIC_LOWER,
    ALPHANUMERIC_UPPER,
    ALPHANUMERIC_MIXED,
    ALPHANUMERIC_MIXED_SYMBOLS,
    CHARACTER_SETS,
    DEFAULT_CHARACTER_SET,
    DEFAULT_PASSWORD_LENGTH,
    camelCaseString,
    showError,
    showSuccess
};