async function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms, 'sleep');
    });
}
function parseMessage(message) {
    try {
        return JSON.parse(message);
    }
    catch (error) {
        console.error(`Failed to parse message: ${message.toString()}`);
        console.error(error);
        return false;
    }
}
export { sleep, parseMessage };
