module.exports = {
    apps: [{
        name: "myzap-api",
        script: "./api/server.js",
        watch: false,
        env: {
            PORT: 3001,
            NODE_ENV: "production",
            DB_HOST: "localhost",
            DB_USER: "ublochat_user",
            DB_NAME: "ublochat_db"
        }
    }]
}
