Darkbloom : https://www.darkbloom.dev/
- https://github.com/Layr-Labs/d-inference/tree/master
Refer how TEE was utilised to deploy this models in hardened process using vllm-mlx. 
I want to start the openclaw or hermes deployment the sameway in hardedned process or enclave in macbook. 



- The worker binary should be installable with just a single curl command so supplier can easily install
- it can use any process while bootup but all the process should run in TEE environment 
- once the desired state was achieved, the worker sends the signal to marketplace API
- Consumer can hire this supplier's agent, Model,Sandbox or this combination of offerings.
- Supplier can market their offerings in our marketplace and set the price for each offering. 
- Market place gets the uptime, resource usage and other metrics from the workers, scores the machies and shows the ranking in the marketplace. this ranking can be used by consumer to select the supplier.
- Marketplace handles the payment and economics, consumer pays the marketplace and marketplace pays the supplier with a commission. 

Tech stack :
- Rust, or swift whereever the enclave implementation is easy
- if needed feel free to use temporal for orchestation of worker management
- Fastapi for marketplace API
- uptime, resource usage data collection should be collected in postgres for now.
- Scoring the supplier machines can be run as background job in the marketplace server, and the ranking can be stored in postgres as well.
- Stripe for payments and store the payments data in postgres. 
- Marketplace should be able to delete the worker process running in supplier machine if the consumers stops the payment or for some other reason. send a signal to worker process to stop the agent and sandbox and then stop the worker process itself.
- Marketplace should be able to store the state of openclaw or hermes agent, since they are saved as markdown files in a filesystem this can be synced to central s3 or other object storage in an encrypted or unencrypted format. This way if the consumer wants to switch the supplier, they can easily move the agent state to new supplier machine
    - marketplace can charge for this offerings as well, since this is a value added service for consumer.
- Marketplace should have a dashboard for suppliers to see the usage, payments, ranking and other metrics related to their offerings.
