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
    const username = data.username;
    const password = data.password;
    console.log("auth:", context.auth);

    return admin.database().ref("/users/").child(username).once("value")
        .then((user_details) => {
            if (user_details === null) {
                console.log("user does not exist");
                return "";
            }
            const actual_passHash = user_details.child("passHash").val();
            const actual_salt = user_details.child("salt").val();
            const passHash = hash_password(password, actual_salt);
            if (actual_passHash !== passHash) {
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
    const caller_type = context.auth.token.type;

    if (caller_type === User_Types.MANAGER) {
        if (user_type !== User_Types.EMPLOYEE) {
            return false;
        }
    } else if (caller_type !== User_Types.ADMIN) {
        return false;
    }
    const user_salt = randomBytes(HASH_SIZE);
    const user_passHash = hash_password(password, salt);
    const user_data = {
        salt: user_salt,
        passHash: user_passHash,
        type: user_type, 
    };
    return admin.database().ref("/users/").child(username).transaction((data) => {
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

function parse_csv(file) {
    var rows = file.split("\n");
    for (i=0; i < rows.length; i++) {
        rows[i] = rows[i].split(",");
    }
    const keys = rows[0];
    var entries = {};
    for (i = 1; i < rows.length; i++) {
        if (rows[i][0] === "") {
            continue;
        }
        entries[rows[i][0]] = {};
        for (j = 1; j < keys.length; j++) {
            entries[rows[i][0]][keys[j]] = rows[i][j];
        }
    }
    return entries;
}

// TODO: location csv -> database
// You can choose to upload the csv file and process it within Firebase Functions, or you can do
// some pre-processing on the app and use the pre-processed results as a parameter.
// The function should check to make sure whoever is trying to use the function is an admin.
// NOTE: .csv file will be in form of string
exports.locationCSVToDb = functions.https.onCall((data, context) => {
    const caller_type = context.auth.token.type;
    // check auth
    if (caller_type !== User_Types.ADMIN) {
        return false;
    }

    // parse csv to json
    const file = data.file;
    const parsed_file = parse_csv(file);

    // add json to db
    admin.database().ref("/locations/").set(parsed_file);
    return true;
});

// TODO: edit location data in the database
// We can can either provide editting functionality, OR just use the previous function to overwrite
// all previous location data.

