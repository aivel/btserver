/**
 * Created by max on 24/04/2017.
 */
const Koa = require('koa');
const body = require('koa-better-body');
const app = new Koa();
const auth = require('./lib/routes/auth');
const game = require('./lib/routes/game');


let world = {
    authorized_users: {'player1': {'token': 'token', 'room': 'test'},
                       'player2': {'token': 'token2', 'room': 'test'},
    },
    rooms: {
        'test': {
            'players': {
                'player1': {
                    'x': 10,
                    'y': 10,
                    'speed': 100,
                    'angle': 33,
                    'health': 10,
                },
                'player2': {
                    'x': 10,
                    'y': 10,
                    'speed': 100,
                    'angle': 33,
                    'health': 10,
                }
            },
            'bullets': [
                {
                    'from_player': 'player1',
                    'when': new Date(),
                    'start': {x: 100, y: 300, speed: 33, angle: 33},
                    'id': 'md5'
                }
            ],
            'hits': [
                {
                    'from_player': 'player1',
                    'to_player': 'player2',
                    'when': new Date(),
                    'bullet_id': '35678'
                }
            ]
        }
    }
};

app
    .use(body())
    .use(auth(world).routes())
    .use(game(world).routes())
    .listen(3309, '0.0.0.0', function () {
        console.log('koa server start listening on port 3309')
    });

