/**
 * Created by max on 24/04/2017.
 */

const md5 = require('md5');

function mount(world) {
    const router = require('koa-router')();

    const INIT_PLAYERS = {
        0: { // player 1
            x: 0,
            y: 0,
            speed: 0,
            angle: 0,
            health: 10,
        },
        1: { // player 2
            x: 100,
            y: 0,
            speed: 0,
            angle: 180,
            health: 10,
        }
    };

    function RESULT_AUTH_ERROR(ctx) {
        ctx.body = JSON.stringify({'status': 'fail', 'error': 'Already authorized'})
    }

    function RESULT_ROOM_IS_FULL_ERROR(ctx) {
        ctx.body = JSON.stringify({'status': 'fail', 'error': 'Room is full, try another one'})
    }

    function RESULT_OK(ctx, token, update) {
        ctx.body = JSON.stringify({'status': 'ok', 'result': {'token': token, 'update': update}});
    }

    router.post('/auth', function (ctx, next) {
        let username = ctx.request.fields.username;
        let room_name = ctx.request.fields.room;

        console.log(`Auth: ${username}, ${room_name}`);

        if (username != null && room_name != null) {
            for (let authorized_username of Object.keys(world.authorized_users)) {
                // world.authorized_users[username];
                if (authorized_username == username) {
                    break;
                    // return RESULT_AUTH_ERROR(ctx);
                }
            }
        }

        let room = world.rooms[room_name];

        if (room == null) {
            room = {players: {}, hits: [], bullets: []}
        }

        if (Object.keys(room.players).indexOf(username) != -1) {
            let update = JSON.parse(JSON.stringify(room.players[username]));
            let token = md5(username + room);
            return RESULT_OK(ctx, token, update)
        }

        if (Object.values(room) != null && Object.values(room.players).length > 1) {
            return RESULT_ROOM_IS_FULL_ERROR(ctx);
        }

        let token = md5(username + room);

        world.authorized_users[username] = {'token': token, 'room': room_name};

        let update = JSON.parse(JSON.stringify(INIT_PLAYERS[Object.keys(room.players).length]));

        room.players[username] = update;

        world.rooms[room_name] = room;

        return RESULT_OK(ctx, token, update);
    });

    return router
}

module.exports = mount;
