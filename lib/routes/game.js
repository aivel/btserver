/**
 * Created by max on 24/04/2017.
 */

const md5 = require('md5');


function mount(world) {
    const router = require('koa-router')({
        prefix: '/game'
    });

    function getUsername(ctx, world) {
        let token = ctx.request.fields.token;

        let username = null;

        for (let authorized_username in world.authorized_users) {
            if (!world.authorized_users.hasOwnProperty(authorized_username)) {
                continue;
            }

            if (world.authorized_users[authorized_username]['token'] == token) {
                username = authorized_username;
                break;
            }
        }

        return username;
    }

    function isAuthorized(ctx, world) {
        return getUsername(ctx, world) != null;
    }

    // ======= Game logic helpers

    function applyUpdate(ctx, world, room, update) {
        /*
            Update {
                type: move/fire/hit,
                source: player1
                data: {
                    delta: {x, y, speed, angle},  - for type == "move"
                    start: {x, y, speed, angle},  - for type == "fire"
                    bullet_id                     - for type == "hit"
                    stop: {x, y, speed, angle},   - for type == "hit"
                }
            }
         */
        function handleMove(from_player, room, delta) {
            room['players'][from_player]['x'] += delta['x'];
            room['players'][from_player]['y'] += delta['y'];
            room['players'][from_player]['speed'] += delta['speed'];
            room['players'][from_player]['angle'] += delta['angle'];
        }

        function handleFire(from_player, room, start) {
            if (room['bullets'] == null) {
                room['bullets'] = [];
            }

            let when = new Date();

            room['bullets'].push({
                'from_player': from_player,
                'when': when,
                'start': start,
                'id': md5(from_player + when.toISOString())
            });

            return true;
        }

        function handleHit(update_author, room, stop, bullet_id) {
            let corresponding_bullets = room['bullets'].filter(b => {
                return b.id == bullet_id;
            });
            let corresponding_hits = room['hits'].filter(h => {
                return h.bullet_id == bullet_id;
            });

            if (corresponding_bullets.length < 1 && corresponding_hits.length < 1) {
                return false;
            }

            if (room['hits'] == null) {
                room['hits'] = [];
            }

            if (corresponding_hits.length < 1) {
                // first hit of the pair

                corresponding_hits = [];
                let new_hit = {
                    'from_player': null,
                    'to_player': null,
                    'bullet_id': bullet_id,
                    'when': new Date()
                };
                corresponding_hits.push(new_hit);
                room['hits'].push(new_hit);

                // cleanup the bullet
                room['bullets'] = room['bullets'].filter(b => b.id != bullet_id);
            }

            let hits_to_delete = [];

            for (let corresponding_hit of corresponding_hits) {
                if (corresponding_hit['from_player'] == null && corresponding_hit['to_player'] != update_author_username) {
                    corresponding_hit['from_player'] = update_author_username;
                } else if (corresponding_hit['to_player'] == null && corresponding_hit['from_player'] != update_author_username) {
                    corresponding_hit['to_player'] = update_author_username;
                }

                if (corresponding_hit['from_player'] != null && corresponding_hit['to_player'] != null) {
                    // got two confirmations - can proceed
                    for (let player_username of Object.keys(room['players'])) {
                        let player = room['players'][player_username];

                        if (player_username == corresponding_hit['to_player']) {
                            player['health'] -= 1;  // decrease health by 1
                            hits_to_delete.push(corresponding_hit);
                        }
                    }
                }
            }

            // filter out counted hits
            room['hits'] = room['hits'].filter(h => hits_to_delete.indexOf(h) == -1);
            return true;
        }

        let update_author_username = getUsername(ctx, world);

        switch (update.type) {
            case "move":
                if (update_author_username != update.source) {
                    // only update author may be the source of move update
                    return false;
                }

                handleMove(update.source, room, update.data.delta);
                break;
            case "fire":
                if (update_author_username != update.source) {
                    // only update author may be the source of move update
                    return false;
                }

                handleFire(update.source, room, update.data.start);
                break;
            case "hit":
                handleHit(update.source, room, update.data.stop, update.data.bullet_id);
                break;
        }
    }

    function removeStaleBullets(room) {
        if (room['bullets'] == null) {
            room['bullets'] = []
        }

        room['bullets'] = room['bullets'].filter(b => {
            return Math.abs(b.when.getTime() - new Date().getTime()) <= 5000;
        });
    }
    function removeStaleHits(room) {
        if (room['hits'] == null) {
            room['hits'] = []
        }

        room['hits'] = room['hits'].filter(h => {
            return Math.abs(h.when.getTime() - new Date().getTime()) <= 5000;
        });
    }

    function applyUpdates(ctx, world, updates) {
        let username = getUsername(ctx, world);
        let user_room_name = world.authorized_users[username]['room'];

        let user_room = world.rooms[user_room_name];

        removeStaleBullets(user_room);
        removeStaleHits(user_room);

        for (let update of updates) {
            applyUpdate(ctx, world, user_room, update);
        }
    }

    // ======= Result generation

    function RESULT_UNAUTHORIZED_ERROR(ctx) {
        ctx.body = JSON.stringify({'status': 'fail', 'error': 'Unauthorized access'});
    }

    function RESULT_ROOM_STATE(ctx, world) {
        let username = getUsername(ctx, world);

        let user_room_name = world.authorized_users[username]['room'];
        let room = world.rooms[user_room_name];

        ctx.body = JSON.stringify({'status': 'ok', 'result': {'room': room, 'room_name': user_room_name}});
    }

    function RESULT_LIST_ROOMS(ctx, world) {
        let rooms_list = [];

        for (let room_name in world.rooms) {
            if (world.rooms.hasOwnProperty(room_name)) {
                rooms_list.push({
                    room_name,
                    active_players: Object.values(world.rooms[room_name]).length
                })
            }
        }

        ctx.body = JSON.stringify(rooms_list);
    }

    // ======= Route handling

    router.post('/listRooms', function (ctx, next) {
        if (! isAuthorized(ctx, world)) {
            return RESULT_UNAUTHORIZED_ERROR(ctx);
        }

        return RESULT_LIST_ROOMS(ctx, world);
    });

    router.post('/pushUpdates', function (ctx, next) {
        if (! isAuthorized(ctx, world)) {
            return RESULT_UNAUTHORIZED_ERROR(ctx);
        }

        let updates = ctx.request.fields.updates;

        if (updates == null || updates.length == 0) {
            return RESULT_ROOM_STATE(ctx, world);
        }

        applyUpdates(ctx, world, updates);

        return RESULT_ROOM_STATE(ctx, world);
    });

    router.post('/getState', function (ctx, next) {
        if (! isAuthorized(ctx, world)) {
            return RESULT_UNAUTHORIZED_ERROR(ctx);
        }

        return RESULT_ROOM_STATE(ctx, world);
    });

    return router;
}

module.exports = mount;
