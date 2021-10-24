# node-native-app
Application build with no 3rd party packages or frameworks

# create folder https in root directory
mkdir https

# generate keys key.pem and cert.pem and place them in https folder
openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem