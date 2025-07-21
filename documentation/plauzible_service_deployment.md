# Deploying The Plauzible Service

This document outlines details for deploying the Plauzible remote service
application. The deployment is assumed to take place from within a Linux
environment, with Ubuntu being assumed as the Linux system used. These
instructions should also work for Ubuntu from with the Windows Subsystem
for Linux (WSL).

## Create A Deployment User

For convenience and security, deployments should take place from a separate
user account. For the purposes of this document this will be assumed to be a
user called ``deploy``. To start this process, issue the following command to
create the user...

```shell
  $> sudo useradd -m deploy
```

## Install The Deployment SSH Key

A key pair for the execution of deployment has been created. You will need to
obtain a copy of these public and private keys. These keys are used to secure
the deployment environment and should, therefore, be handled carefully to
ensure they are not made widely available or stored in a source controlled
repository.

If it does not exist yet, create a ``.ssh`` folder for the ``deploy`` user in
their ``$HOME`` folder by executing the following commands...

```shell
  $> cd
  $> mkdir .ssh
  $> chmod 700 .ssh
```

Copy the ``id_rsa`` and ``id-rsa.pub`` files into the ``.ssh`` folder then
execute the following commands to ensure they have the correct permissions on
them...

```shell
  $> chmod 600 ~/.ssh/id_rsa
  $> chmod 644 ~/.ssh/id_rsa.pub
```

**NOTE:** These key files should have already been 'installed' on the remote
servers and with Github to grant access. If this is not the case then it will need
to be done before proceeding.

### Installing SSH On A Remote Server

If you need to install an SSH key on a remote server then you need to copy the
public key part of the pair (i.e. ``id_rsa.pub``) to the server, perhaps using
a utility such as ``scp``. Once the file is available on the remote machine, log
into the machine as the user you are adding the key for. Ensure that this user
has a ``.ssh`` folder and create it if it does not (see above for how to do
this). Then run the following commands from the users ``$HOME`` folder to add the
key for the user...

```shell
  $> touch .ssh/authorized_keys
  $> cat id_rsa.pub >> .ssh/authorized_keys
```

You will also need a copy of the full pair installed on the service. Use a
utility such as ``scp`` to copy both key files into the ``.ssh`` folder of the
deploy user on the remote machine. Ensure these files have the correct
permissions set on them (see above for details).

You can test whether this is successful byt attempting to SSH to the remote
machine using the SSH key pair.

## Clone The Plauzible Service Repository

The first time you are going to deploy you need to clone the Github repository
to your deployment environment. To do this,run the following commands to make a
local copy of the Plauizble Service Github repository...

```shell
$> mkdir src
$> cd src
$> git clone git@github.com:woodzer/plauzible_service.git
```

**NOTE:** This is a good first test of whether the deployment SSH key has been
configured in Github. If the last command listed above fails, then a key issue
is extremely likely to be the cause.

Upon successful completion of these commands, a copy of the Plauzible Serivce
will have been cloned into the ``src\plauzible_service`` folder found within
the ``deploy`` users ``$HOME`` folder.

## Installing RVM And Ruby

We next need to set up Ruby so that it can be used to execute Capistrano, which
is the main deployment tool. [RVM](https://rvm.io/) is the tool we'll use to do
this and installation instructions can be found [here](https://rvm.io/rvm/install).
Follow the installation instructions and, when RVM is fully installed (note you
may have to restart your shell post installation), then install a version of Ruby.
The ``Gemfile`` file found in the root of the Plauzible Servide repository will
indicate which version of Ruby is used. This will generally list an `approximate`
version (e.g. ``'>= 3.0.0'``), so you may want to use the latest version within
this approximation - if you hit issues consider using an earlier version.

The next thing to do is to install all of the relevant libraries that are needed
to perform the deploy. From within the root folder of the Plauzible Service
repository execute the following commands...

```shell
  $> rvm gemset create plauzible_service
  $> rvm gemset use plauzible_service
  $> gem install bundler
  $> bundle install
```

We're making use of RVM's gemset capabilities here to install the required
libraries into their own 'name space'. Note that the ``bundler`` gem may already
be installed, so if the third command reports this it is probably not something
to be concerned about.

These installation commands only need to be executed once. For future
reference, when returning later to run an install, the following command will
suffice...

```shell
  $> rvm gemset use plauzible_service
```

## Performing The Deployment

With all previous steps completed you can execute a deployment by running the
following commands from within the ``$HOME/src/plauzible_service`` folder of
the ``deploy`` user...

```shell
   $> rvm gemset use plauzible_service
   $> bundle exec cap production deploy
```

This invokes the Capistrano deployment tool which will attempt to roll a
version of the Plauzible Service (i.e. latest master) to the production
servers. This will generate a log as it executes and this can be used to
help diagnose any issues that arise.
