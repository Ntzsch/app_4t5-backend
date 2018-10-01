const functions = require("firebase-functions");
const admin = require("firebase-admin")

admin.initializeApp();

const User_Types = { "ADMIN":"admin", "MANAGER":"manager", "EMPLOYEE":"employee",};
const HASH_SIZE = 256;

// exports.testFunc = functions.https.onCall((data, context) => {
//     console.log("You accessed me!")
//     return "return value";
// });

// function: login, accepts username and password, returns token or err
// make sure I change LOCATION (see callable functions firebase)
exports.getToken = functions.https.onCall((data, context) => {
    var username = data.username;
    username = username.replace(/[^A-Za-z0-9]/g, "");
    if (username === "") {
        console.log("invalid username");
        return "";
    }
    var password = data.password;
    console.log("auth:", context.auth);

    return admin.database().ref("/users/" + username).once("value")
        .then((user_details) => {
            if (user_details === null) {
                console.log("user does not exist");
                return "";
            }
            const actual_password = user_details.child("password").val();
            if (actual_password !== password) {
                console.log("incorrect password");
                return "";
            }
            const user_type = user_details.child("type").val();
            console.log("user_type:", user_type);
            console.log("user_type type:", typeof user_type);
            const claims = {
                type: user_type,
            };
            return admin.auth().createCustomToken(username, claims)
                .then((customToken) => {
                    return customToken;
                });
        });
});

// true => success | false => failure
exports.register = functions.https.onCall((data, context) => {
    const username = data.username;
    const password = data.password;
    const user_type = data.type;
    if (context.token.type === User_Types.ADMIN) {
        // can do anything
    } else if (context.token.type === User_Types.MANAGER) {
        if (user_type !== User_Types.EMPLOYEE) {
            return false;
        }
    } else if (context.token.type === User_Types.EMPLOYEE) {
        return false;
    } else {
        return false;
    }
    const user_salt = randomBytes(HASH_SIZE);
    const user_passHash = hash_password(password, salt);
    const user_data = {
        salt: user_salt,
        passHash: user_passHash,
        type: user_type, 
    };
    admin.database().ref("/users/").child(username).transaction((data) => {
        if (data !== null) {
            return undefined;
        }
        console.log(data);
        return user_data;
    }).then((committed, snapshot) => {
        return committed;
    });
});

function hash_password(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, HASH_SIZE, "sha1");
}
