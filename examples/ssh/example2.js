import { Ssh } from '../../src/ssh.js';
import * as std from 'std';
import * as os from 'os';

/*
    Setup local port forwarding through 2 servers
    client => vault1 => vault2 => dest
 */
const main = async () => {
    /*
        Declare tunnels
     */
    const tunnels = [
        new Ssh('root@vault1', '', {
            localForward:{remoteAddr:'vault2', localPort:10001, remotePort:22},
            context:{'name':'tunnel1'}
        }),
        new Ssh('root@127.0.0.1:10001', '', {
            localForward:[
                {remoteAddr:'dest', localPort:10002, remotePort:22}
            ],
            context:{'name':'tunnel2'}
        })
    ];
    /*
        Wait until both sessions are setup
     */
    for (let i = 0; i < tunnels.length; ++i) {
        if (!await tunnels[i].waitForSessionSetup()) {
            console.log(`Could not setup tunnel (${tunnels[i].context.name}) : (${tunnels[i].sshErrorReason})`);
            console.log(tunnels[i].sshError);
            // cancel all tunnels
            tunnels.forEach((t) => {
                t.cancel();
            });
            std.exit(1);
        }
        else {
            console.log(`Successfully setup tunnel (${tunnels[i].context.name})`);
        }
    }
    console.log(`Both tunnels successfully setup`);
    /*
        In case forwarding fails after connection, tunnel will exit with an SSH error
     */
    tunnels.forEach((t) => {
        t.setEventListener('exit', (obj) => {
            if (undefined !== obj.sshErrorReason) {
                console.log(`Error (${obj.context.name}) : ${obj.sshErrorReason}`);
                console.log(obj.sshError);
                // cancel all tunnels
                tunnels.forEach((t) => {
                    t.cancel();
                });
            }
        });
    });
}

main();
