# Getting Started

This document outlines how to get the Plauzible system up and running in a
local context.

## Running Up The Client

The Plauzible client is written using [Tauri](https://tauri.app/) and, for
use in the local environment, makes use of [Bun](https://bun.sh/), so this
will need to be install in your environment. The Git repository can be found
[here](https://github.com/woodzer/plauzible). To get the client up and
running do the following...

 - Clone the repository.
 - Run ``bun install`` in the root of the repository.
 - Run the ``bun run tauri dev`` command to start the client.

## Starting The Remote Service

The remote service is a [Ruby](https://www.ruby-lang.org/en/) application that
makes use of the [Grape](https://github.com/ruby-grape/grape) framework. To run
the service up do the following...

 - Install Ruby (version 3+).
 - Clone the respository (found [here](https://github.com/woodzer/plauzible_service)).
 - Run ``bundle install`` in the root directory of the repository.
 - Run the ``rackup`` command.

### Using Ngrok

The service application will generally start on port 9292, so to use [ngrok](https://ngrok.com)
with the service use the command ``ngrok http 9292``. This will provide you with a forwarding
URL that you can use to access the service.

#### End-To-End Testing

There are several aspects that need to be running to full testing of the client application
making use of the remote service. The structure for this has been encapsulated in a collection
of Docker containers. These can be spun up as a combined collection using the Docker compose
application. The set up for this is found in the ``docker`` folder of the Plauzible client
application repository.

There is an element of configuration that needs to be set up to use this facility. First, you'll
need a Stripe account and create a sandbox for use with testing. This will provide you with a
set of API keys (see later for how these are used). You will also need to create a subscription
product within this sandbox called ``Plauzible Base Subscription`` - it will be looked up by
name so it has to be this.

You will also need ``ngrok`` up and running and redirecting port ``8080``.

With Stripe set up, you can open the ``docker-compose.yml`` file, which is found in the ``docker``
folder of the repository. Inside this file you will need to configure the following environment
variables for the ``app`` entry...

 - **API_URL_BASE** - This should be set to the value provided by ``ngrok``, if you are using
   it, or ``localhost:9292`` is you are using the service purely locally (update the port
   number if this is not the correct one).
 - **NGROK_HOST** - The host name for your currently running ``ngrok`` instance. Note this is
   just the host value.
 - **STRIPE_PUBLISHABLE_KEY** - The publishable key (i.e. the one that starts ``pk``) for your
   your Stripe sandbox.
 - **STRIPE_SECRET_KEY** - The publishable key (i.e. the one that starts ``sk``) for your
   your Stripe sandbox.

You will also need a [Mailtrap](https://mailtrap.io) account. This account will provide a
details that need to be configured into the environment variables for the ``sidekiq``
server in the docker-compose file. These are the variables that need to be set...

 - **MAILTRAP_API_KEY** - Use the test/sandbox key provided by Mailtrap for testing purposes.
 - **MAILTRAP_API_URL** - Use ``sandbox.api.mailtrap.io`` for testing.

Note that Stripe sandbox instances are often reset, so you may need to reset this values when
there is a substantial amount of time between testing efforts.

When this is all ready, you can run up the collections of elements (assuming you have Docker
and docker-compose installed) using the command line...

```
  $> docker-compose up --build
```

## Configuring The Application


