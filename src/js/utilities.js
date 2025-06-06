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
    camelCaseString,
    showError,
    showSuccess
};