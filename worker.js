const { processAction } = require('./actionProcessor');

class HubSpotMeetingsWorker {
  constructor(hubspotClient, contactService) {
    this.hubspotClient = hubspotClient;
    this.contactService = contactService;
  }

  async processMeetings() {
    try {
      const meetingsResponse = await this.fetchRecentMeetings();
      
      for (const meeting of meetingsResponse.results) {
        await this.processIndividualMeeting(meeting);
      }
    } catch (error) {
      console.error('Error processing meetings:', error);
    }
  }

  async fetchRecentMeetings() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return this.hubspotClient.crm.objects.basicApi.getPage(
      'meetings', 
      10,
      undefined,
      [
        'hs_meeting_title', 
        'hs_meeting_start_time', 
        'hs_meeting_end_time', 
        'hs_created_by', 
        'hs_timestamp'
      ],
      `hs_timestamp:>${yesterday.toISOString()}`
    );
  }

  async processIndividualMeeting(meeting) {
    const actionType = this.determineMeetingActionType(meeting);
    
    const attendeeEmails = await this.fetchMeetingAttendees(meeting.id);
    
    for (const email of attendeeEmails) {
      const actionData = {
        meetingId: meeting.id,
        title: meeting.properties.hs_meeting_title,
        startTime: meeting.properties.hs_meeting_start_time,
        endTime: meeting.properties.hs_meeting_end_time,
        createdBy: meeting.properties.hs_created_by,
        contactEmail: email
      };

      await processAction(actionType, actionData);
    }
  }

  determineMeetingActionType(meeting) {
    const createdDate = new Date(meeting.createdAt);
    const modifiedDate = new Date(meeting.updatedAt);

    return createdDate.getTime() === modifiedDate.getTime() 
      ? 'Meeting Created' 
      : 'Meeting Updated';
  }

  async fetchMeetingAttendees(meetingId) {
    try {
      const attendees = await this.contactService.getMeetingAttendees(meetingId);
      return attendees.map(contact => contact.email);
    } catch (error) {
      console.error(`Could not fetch attendees for meeting ${meetingId}:`, error);
      return [];
    }
  }
}

module.exports = HubSpotMeetingsWorker;