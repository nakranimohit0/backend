var models = require('../Model');
var Promise = require('bluebird');
var moment = require('moment');
var TaskFactory = require('./TaskFactory.js');
var _ = require('underscore');

var User = models.User;
var UserLogin = models.UserLogin;
var UserContact = models.UserContact;
var Course = models.Course;
var Section = models.Section;
var SectionUser = models.SectionUser;
var Semester = models.Semester;
var TaskInstance = models.TaskInstance;
var TaskActivity = models.TaskActivity;
var Assignment = models.Assignment;
var AssignmentInstance = models.AssignmentInstance;
var WorkflowInstance = models.WorkflowInstance;
var WorkflowActivity = models.WorkflowActivity;
var ResetPasswordRequest = models.ResetPasswordRequest;
var EmailNotification = models.EmailNotification;

const logger = require('winston');

class Allocator {

    //constructor, give users and one workflow from WorkflowTiming
    constructor(users, userIndex) {
        this.users = users;
        this.workflow = {};
        this.pointer = userIndex;
        this.count = 0;
    }

    getRightUser(ta_id) {
        let x = this;
        let taskUser = []

        return new Promise(function(resolve, reject) {
            return TaskActivity.find({
                where: {
                    TaskActivityID: ta_id
                }
            }).then(function(ta) {

                let constraints = JSON.parse(ta.AssigneeConstraints)[2];

                if (JSON.parse(ta.AssigneeConstraints)[0] === "instructor") {
                    return x.getInstructor(ta_id).then(function(instructor) {
                        taskUser.push(instructor);
                        resolve(taskUser);
                    });
                } else {

                    if (ta.Type === 'needs_consolidation' ){//|| ta.Type === 'completed') {
                        if (Object.keys(x.workflow).length < 1) {
                            var same = constraints.same_as[0];
                            console.log('same', same);
                            console.log('workflow', x.workflow);
                            taskUser.push(0);
                        } else {
                            var same = constraints.same_as[0];
                            console.log('same', same);
                            console.log('workflow', x.workflow);
                            taskUser.push(x.workflow[same][0]);
                        }
                    } else if (_.isEmpty(constraints)) {
                        //return the first one in the user list
                        taskUser.push(x.user(ta_id));
                        x.count++;
                    } else if (_.has(constraints, "same_as") && !(_.has(constraints, "not"))) {
                        var same = constraints.same_as[0];
                        console.log('same', same);
                        console.log('workflow', x.workflow);
                        taskUser.push(x.workflow[same][0]);
                    } else if (!(_.has(constraints, "same_as")) && _.has(constraints, "not")) {
                        while (_.contains(constraints.not, x.users[x.count])) {
                            x.count++;
                        }
                        taskUser.push(x.user(ta_id));
                        x.count++;
                    } else if (_.has(constraints, "same_as") && _.has(constraints, "not")) {
                        while (_.contains(constraints.not, x.users[x.count])) {
                            x.count++;
                        }
                        taskUser.push(x.user(ta_id));

                        if (ta.Type === 'grade_problem' && ta.NumberParticipants > 1) {
                            var same = constraints.same_as[0];
                            console.log('same', same);
                            console.log('workflow', x.workflow);
                            taskUser.push(x.workflow[same][0]);
                        }
                        x.count++;
                    }
                }
            }).then(function(done) {
                x.workflow[ta_id] = taskUser;
                resolve(taskUser);
            }).catch(function(err) {
                console.log("Error allocating the users");
                reject(err);
            });
        });
    }

    user(ta_id) {
        let x = this;
        let index = x.pointer + x.count;
        if (index == x.users.length) {
            x.count = 0 - x.pointer;
            index = x.pointer + x.count;
            return x.users[index];
        } else {
            return x.users[index];
        }
    }

    getInstructor(ta_id) {
        return new Promise(function(resolve, reject) {

            return TaskActivity.find({
                where: {
                    TaskActivityID: ta_id
                }
            }).then(function(ta_result) {
                return Assignment.find({
                    where: {
                        AssignmentID: ta_result.AssignmentID
                    }
                }).then(function(assignment) {
                    resolve(assignment.OwnerID);
                });
            }).catch(function(err) {
                console.log('Error retrieving instructor ID');
                console.log(err);
            });
        });
    }


    //-------------------------------------------------------
    // get taskActivityID linked to this task
    getTaskActivityID(task) {



        return new Promise(function(resolve, reject) {

            //console.log('Finding the taskActivityID...');

            var taskActivityID = [];


            TaskInstance.findAll({
                where: {
                    TaskInstanceID: task
                }
            }).then(function(results) {

                //taskActivityID.push(results.TaskActivityID);
                results.forEach(function(task) {
                    //tasks.push(task.TaskActivityID);
                    taskActivityID.push(task.TaskActivityID);
                }, this);

                //console.log('taskActivityID was found!');

                resolve(taskActivityID);

            }).catch(function(err) {
                console.log('Find taskActivityID failed!');
                console.log(err);
            });

        });

    }

    // get AssigneeConstraints linked to this taskActivityID
    getConstraints(ta_id) {

        return new Promise(function(resolve, reject) {
            var constraints;
            return TaskActivity.find({
                where: {
                    TaskActivityID: ta_id
                }
            }).then(function(result) {
                constraints = JSON.parse(result.AssigneeConstraints);
                //console.log(constraints);
                //console.log('All constraints were saved!');

                resolve(constraints);
            }).catch(function(err) {
                console.log('Find constraints failed!');
                reject(err);
            });
        });
    }

    //get user that will be removed from workflow instance
    getLateUser(task) {

        return new Promise(function(resolve, reject) {
            //console.log('Finding the late user...');
            var lateUser;
            TaskInstance.findAll({
                where: {
                    TaskInstanceID: task
                }
            }).then(function(results) {

                results.forEach(function(task) {
                    lateUser = task.UserID;
                }, this);
                //console.log('lateUser was found!');
                resolve(lateUser);
            }).catch(function(err) {
                console.log('Find workflowInstanceID failed!');
                console.log(err);
            });
        });
    }





    // get workflowInstanceID linked to this task
    getWorkflowInstanceID(task) {


        return new Promise(function(resolve, reject) {

            //console.log('Finding the workflowInstanceID...');

            var workflowInstanceID = [];


            TaskInstance.findAll({
                where: {
                    TaskInstanceID: task
                }
            }).then(function(results) {

                //workflowInstanceID.push(results.WorkflowInstanceID);
                results.forEach(function(workflow) {
                    workflowInstanceID.push(workflow.WorkflowInstanceID);
                }, this);

                //console.log('workflowInstanceID was found!');

                resolve(workflowInstanceID);

            }).catch(function(err) {
                console.log('Find workflowInstanceID failed!');
                console.log(err);
            });
        });
    }

    //get students in the workflowInstanceID - this students will be avoided
    getUsersFromWorkflowInstance(wi_id) {



        return new Promise(function(resolve, reject) {

            //console.log('Finding the users in the workflowInstanceID...');

            var avoid_users = [];

            TaskInstance.findAll({
                where: {
                    WorkflowInstanceID: wi_id
                }
            }).then(function(results) {

                results.forEach(function(user) {
                    avoid_users.push(user.UserID);
                }, this);


                //console.log('users in workflowInstanceID were found!');

                resolve(avoid_users);

            }).catch(function(err) {
                console.log('Find users in workflowInstanceID failed!');
                console.log(err);
            });
        });
    }

    //get ti_id where user is allocated within a wi_id
    getTaskInstancesWhereUserAlloc(user, wi_id, ti_id) {
        //console.log('Finding the TaskInstances...');


        return new Promise(function(resolve, reject) {

            var tempAllocRecord = [];
            tempAllocRecord.push(ti_id);

            TaskInstance.findAll({
                where: {
                    WorkflowInstanceID: wi_id,
                    UserID: user
                }
            }).then(function(results) {

                results.forEach(function(result) {
                    if (result.TaskInstanceID > ti_id) {
                        tempAllocRecord.push(result.TaskInstanceID);
                    }
                }, this);

                resolve(tempAllocRecord);
                //console.log('TaskInstances were found!');
                //tempAllocRecord.push(ti_id);


            }).catch(function(err) {
                console.log('Find TaskInstances failed!');
                console.log(err);
            });
        });
    }

    // Previous implementation of get user (before spring 2017)
    /*//get newUser
    getUserPre(avoid_users, users) {
        //console.log(typeof users)
        // console.log("getUser() users", users)
        var new_user
        // var new_users = []
        var idx
        return Promise.all(Promise.map(users, function (user, i) {
            if (!_.contains(avoid_users, user)) {
                if (idx == null) {
                    idx = i
                }
                // new_users.push(user)
                // console.log('users shift', users)
            }

        })).then(function (done) {
            new_user = users[idx] //new_users[0]
            // console.log('prev::', users)
            users.splice(idx, 1)
            users.push(new_user)
            // console.log('new::', users)
            return new_user
        })
    }*/

    //TODO: need an api call for this
    // reallocate new users to all tasks of all users in all assignments of a section with volunteers
    reallocate_section(section_id, user_ids, volunteer_u_ids, is_extra_credit) {
        if (is_extra_credit == null) { // if extra credit is not specified: assume it is extra credit by default
            is_extra_credit = true
        }
        logger.log('info', 'reallocate new users to all tasks of all users in all assignments of a section with volunteers', {
            section_id: section_id,
            user_ids: user_ids,
            volunteer_u_ids: volunteer_u_ids,
            is_extra_credit: is_extra_credit,
        })
        var x = this
        // check if any user_id is part of volunteers, if so: remove it from volunteers
        volunteer_u_ids = volunteer_u_ids.filter(function (user_id) {
            return !_.contains(user_ids, user_id)
        })
        return AssignmentInstance.findAll({
            where: {
                SectionID: section_id,
                //TODO: For future: get only active assignments
            }
        }).then(function (ais) {
            return Promise.map(ais, function (ai) {
                return x.reallocate_ai(ai.AssignmentInstanceID, user_ids, volunteer_u_ids, is_extra_credit)
            })
        })
    }

    //TODO: need an api call for this
    // reallocate new users to all tasks of all users in an assignment with volunteers
    reallocate_ai(ai_id, user_ids, volunteer_u_ids, is_extra_credit) {
        if (is_extra_credit == null) { // if extra credit is not specified: assume it is extra credit by default
            is_extra_credit = true
        }
        logger.log('info', 'reallocate new users to all tasks of all users in an assignment with volunteers', {
            ai_id: ai_id,
            user_ids: user_ids,
            volunteer_u_ids: volunteer_u_ids,
            is_extra_credit: is_extra_credit,
        })
        var x = this
        // check if any user_id is part of volunteers, if so: remove it from volunteers
        volunteer_u_ids = volunteer_u_ids.filter(function (user_id) {
            return !_.contains(user_ids, user_id)
        })
        return TaskInstance.findAll({
            where: {
                UserID: {
                    $in: user_ids,
                },
                AssignmentInstanceID: ai_id,
                Status: {
                    $notIn: ['complete'],
                    //TODO: For future: get only non-opened task instances
                }
            }
        }).then(function (tis) {
            return Promise.each(tis, function (ti) {
                return x.reallocate(ti, volunteer_u_ids, is_extra_credit)
            })
        })
    }

    //TODO: need an api call for this
    // reallocate given users to given tasks respectively
    reallocate_users_to_tasks(tis, u_ids, is_extra_credit) {
        logger.log('debug', {call: 'reallocate_users_to_tasks'})
        if (is_extra_credit == null) { // if extra credit is not specified: assume it is extra credit by default
            is_extra_credit = true
        }
        logger.log('info', 'reallocate given users to given tasks respectively', {
            is_extra_credit: is_extra_credit,
            user_ids: u_ids, task_instances: tis.map(function (it) {
                return it.toJSON()
            }),
        })
        var x = this

        return Promise.map(tis, function (ti, i) {
            return x.reallocate_user_to_task(ti, u_ids[i], is_extra_credit)
        })
    }

    // reallocate given user to a given task instance
    reallocate_user_to_task(ti, new_u_id, is_extra_credit) {
        if (is_extra_credit == null) { // if extra credit is not specified: assume it is extra credit by default
            is_extra_credit = true
        }
        logger.log('debug', {call: 'reallocate_user_to_task'})
        var task_id = ti.TaskInstanceID
        // append a new user history
        var ti_u_hist = JSON.parse(ti.UserHistory) || []

        ti_u_hist.push({
            time: new Date(),
            user_id: new_u_id,
            is_extra_credit: is_extra_credit,
        })
        logger.log('info', 'update a task instance with a new user and user history', {
            task_instance: ti.toJSON(),
            new_user_id: new_u_id,
            user_history: ti_u_hist
        })

        return TaskInstance.update({
                UserID: new_u_id,
                UserHistory: ti_u_hist,
            }, {
                where: {TaskInstanceID: task_id}
            }
        ).then(function (res) {
            logger.log('info', 'task instance updated', {res: res})
            return res
        }).catch(function (err) {
            logger.log('error', 'task instance update failed', err)
            return err
        })
    }

    // find a new appropriate user to reallocate
    find_new_user(u_ids, vol_u_ids, avoid_u_ids) {
        logger.log('debug', {call: 'find_new_user'})
        logger.log('info', 'find a new appropriate user to reallocate', {
            user_ids: u_ids,
            volunteer_user_ids_so_far: vol_u_ids,
            avoid_user_ids: avoid_u_ids,
        })
        vol_u_ids = vol_u_ids || []
        var idx = null

        // first, find if there is a new user that has not been part of volunteers so far used for this assignment AND that has not been part of avoid users
        return Promise.map(u_ids, function (u_id) {
            if (idx == null && !_.contains(avoid_u_ids, u_id) && !_.contains(vol_u_ids, u_id)) {
                vol_u_ids.unshift(u_id)
                idx = 0
            }
        }).then(function (done) {
            logger.log('info', 'found a new user that is not part of volunteers yet ?', {found: idx != null})

            // if not found a user yet: pick the first one from volunteers so far and that is not part of avoid users
            return Promise.map(vol_u_ids, function (u_id, i) {
                if (idx == null && _.contains(u_ids, u_id) && !_.contains(avoid_u_ids, u_id)) {
                    idx = i
                }
            }).then(function (done) {
                if (idx == null) {
                    logger.log('error', 'no user found that can be reallocated')
                    return
                }
                var new_user_id = vol_u_ids[idx] //new_user_id[0]
                // reorder the volunteers used so far for this assignment
                vol_u_ids.splice(idx, 1)
                vol_u_ids.push(new_user_id)

                logger.log('info', 'volunteers updated & return a new chosen user', {
                    updated_volunteer_user_ids_so_far: vol_u_ids,
                    new_user_id: new_user_id,
                })
                return new_user_id
            })
        })
    }

    // get volunteers so far used for the given assignment
    get_ai_volunteers(ai_id) {
        logger.log('debug', {call: 'get_ai_volunteers', ai_id: ai_id})

        return AssignmentInstance.find({where: {AssignmentInstanceID: ai_id}}).then(function (ai) {
            logger.log('debug', 'return', {assignment_instance: ai.toJSON()})
            return JSON.parse(ai.Volunteers)
        })
    }

    //////////////////////////////////////////////////////////////////
    ///////////Reallocate a new user to a given task instance/////////
    //////////////////////////////////////////////////////////////////

    //ti_id = User(TaskInstanceID) to be reallocated
    //u_ids = list (pool) of users to pick the new user from
    //x.getLateUser(task) = the user that has been late for submitting his/her work; TaskInstance Type has been marked as 'late'
    //x.getTaskActivityID(task) & x.getWorkflowInstanceID(task) = find TaskActivityID and WorkflowInstanceID associate with the task
    //Promise.map(list, function(each_index_from_the_list){}) - for details you can check bluebird.js
    //x.getUsersFromWorkflowInstance(wi_id) = find users within the same workflow, used to find the list of user that should be avoided
    //x.getTaskInstancesWhereUserAlloc(lateUser, wi_id, task) = find all the TaskInstances within the workflow that have the same UserID
    //x.find_new_user(u_ids, vol_u_ids, avoid_u_ids) = find a new appropriate user to reallocate
    //x.reallocate_user_to_task(task, newUser) = reallocate given user to a given task instance

    //Done: The algorithm would always reallocate the first user from the list obtained. Needs to update the list of the users so
    //the same user won't be reallocated second time.

    reallocate(ti, u_ids, is_extra_credit) {
        logger.log('debug', {call: 'reallocate'})
        if (is_extra_credit == null) { // if extra credit is not specified: assume it is extra credit by default
            is_extra_credit = true
        }
        logger.log('info', 'reallocate new user to a given task instance', {
            task_instance: ti.toJSON(),
            user_ids: u_ids,
            is_extra_credit: is_extra_credit,
        })

        var ti_id = ti.TaskInstanceID
        var x = this
        // var task = ti_id //task instance needs to be given
        // var constraint
        // var lateUser
        // var avoid_users = []
        // var users = userList // users need to be given
        //console.log(users)

        /*Promise.all([]).spread(function(lateUsers, volunteers) {
         lateUser = done[0]
         //console.log(lateUser)
         })*/
        // return Promise.all([x.getLateUser(ti_id), x.getVolunteers(ti), x.getTaskActivityID(ti_id), x.getWorkflowInstanceID(ti_id)]).spread(function (lateUsers, vol_u_ids, ta_ids, workflowInstanceIDs) {
        return Promise.all([x.getLateUser(ti_id), x.get_ai_volunteers(ti.AssignmentInstanceID), x.getWorkflowInstanceID(ti_id)]).spread(function (lateUsers, vol_u_ids, wi_ids) {
            // console.log('vol:' + volunteers)
            vol_u_ids = vol_u_ids || []
            // return Promise.map(taskActivityIDs, function (ta_id) {
            //console.log(ta_id)
            return Promise.map(wi_ids, function (wi_id) {
                //console.log(wi_id)
                // return Promise.all([x.getUsersFromWorkflowInstance(wi_id), x.getTaskInstancesWhereUserAlloc(lateUsers[0], wi_id, ti_id)]).spread(function (avoid_u_ids, TaskInstances) {
                return Promise.all([x.getUsersFromWorkflowInstance(wi_id)]).spread(function (avoid_u_ids) {
                    // console.log("avoidUsers", avoidUsers)
                    // avoidUsers.map(function(user) {
                    //     avoid_users.push(user)
                    // })
                    return x.find_new_user(u_ids, vol_u_ids, avoid_u_ids).then(function (new_u_id) {
                        // return Promise.map(TaskInstances, function (task) {
                        /*WorkflowInstance.update({
                         Volunteers: volunteers
                         }, {
                         where: {
                         WorkflowInstanceID: ti.WorkflowInstanceID
                         }
                         })*/
                        logger.log('debug', 'update assignment instance volunteers', {
                            assignment_instance_id: ti.AssignmentInstanceID,
                            volunteer_user_ids: vol_u_ids,
                        })
                        return AssignmentInstance.update({
                            Volunteers: vol_u_ids
                        }, {
                            where: {
                                AssignmentInstanceID: ti.AssignmentInstanceID
                            }
                        }).then(function (res) {
                            logger.log('info', 'assignment instance volunteers updated', {res: res})
                            return x.reallocate_user_to_task(ti, new_u_id, is_extra_credit)
                        }).catch(function (err) {
                            logger.log('error', 'assignment instance volunteers update failed', err)
                            return err
                        })
                        // })
                    })
                })
            })
            // })
        })
    }


    //finds the students from the same section
    findSectionUsers(ai_id, callback) {
        AssignmentInstance.find({
            where: {
                AssignmentInstanceID: ai_id
            }
        }).then(function(result) {
            SectionUser.findAll({
                where: {
                    SectionID: result.SectionID
                }
            }).then(function(users) {
                var userArray = [];
                Promise.map(users, function(user) {
                    userArray.push(user.UserID);
                }).then(function(done) {
                    console.log("Users:", userArray);
                    callback(userArray);
                });
            }).catch(function(err) {
                console.log(err);
                throw Error("Cannot find TaskActivity!");
            });
        });
    }

    //finds group members
    findGroupUsers(g_id, callback) {

    }

    //finds group members
    findInstructor(ai_id, callback) {
        AssignmentInstance.find({
            where: {
                AssignmentInstanceID: ai_id
            }
        }).then(function(result) {
            Assignment.find({
                where: {
                    AssignmentID: result.AssignmentID
                },
                attributes: ["OwnerID"]
            }).then(function(instructor) {
                console.log("Inustructor:", instructor.OwnerID);
                callback(instructor.OwnerID);
            }).catch(function(err) {
                console.log(err);
                throw Error("Cannot find TaskActivity!");
            });
        });
    }




};




module.exports = Allocator;
