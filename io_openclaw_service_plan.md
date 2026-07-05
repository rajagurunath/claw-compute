io.net openclaw


- Refer the discussion and plans discussed in this repo. refer some markdown files etc
- binary cli : /Users/gurunathlunkupalivenugopal/ionet/repos/v2_launch_go_binaries
- api_io_worker: /Users/gurunathlunkupalivenugopal/ionet/repos/api_io_worker
  (binary cli is calling api_io_worker i guess)
- frontend: /Users/gurunathlunkupalivenugopal/ionet/repos/v2_webapp_ionet
- api-io-db: /Users/gurunathlunkupalivenugopal/ionet/repos/api_io_db


My plan is to add following 

- binaries should be able to start the openclaw or hermes agent 
- api-io-worker apis should be able to start, stop the agents of this binaries
  - we will call api-io-worker api and this api controls the agent running in particular macbook machines
  - it should save from when to when this agents are runing for which user id
- api_io_db calls the api-io-worker apis
  api_io_db: have apis are controlled by frontend(FE) , FE sends the signals and commands to this api-io-db -> api-io-worker -> binaries (start/stop/other commands)
- we need a way to bill the customer based on their usage hours of particular agents
- we should have a way to connect to this agent via telegram, whatsapp,slack and other channels (configurable)

------------
refer all this repos
- i want to have a page in frontend with the same theme and look which allows the user to create/terminate agents . show different agents available like openclaw, hermes, nemoclaw .
- this will be sent to api-io-worker and api-io-worker chooses one of the mac machine (from the running devices). (which were active and we are giving block rewards for this devices).
- api-io-worker sends the signal to start particular agent and in backend DB (probably new table), adds the entry user_id, device_id, agent_name and other details
- cost depends on what grade of machine user is choosing etc..
- UI should show instructions to connect to particular whatspp or telegram to the end user

---------
This is MVP
- binaries should be able to start/stop agents
- api-io-workers should be able to control the binary behaviour
- frontend/api-io-db should show things to end user and follow the steps accordingly
- For starters target telegram integeration (but this needs to adopted to other channels as well)

channel integeration
- https://docs.openclaw.ai/channels/telegram
- https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram
- https://docs.openclaw.ai/channels/whatsapp

---------------
We are calling this Cloud Agents project so we can name things accordingly ....
