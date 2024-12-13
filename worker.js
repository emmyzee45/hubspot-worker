const hubspot = require('@hubspot/api-client');
const { processAction } = require('./actionProcessor');

class HubSpotMeetingsWorker {
  constructor(hubspotClient, contactService) {
    this.hubspotClient = hubspotClient;
    this.contactService = contactService;
  }

  async processMeetings() {
    try {
      // Fetch meetings modified in the last 24 hours
      const meetingsResponse = await this.fetchRecentMeetings();
      
      for (const meeting of meetingsResponse.results) {
        await this.processIndividualMeeting(meeting);
      }
    } catch (error) {
      console.error('Error processing meetings:', error);
      // Consider adding more robust error handling and logging
    }
  }

  async fetchRecentMeetings() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return this.hubspotClient.crm.objects.basicApi.getPage(
      'meetings', 
      10,  // Pagination limit
      undefined,
      [
        'hs_meeting_title', 
        'hs_meeting_start_time', 
        'hs_meeting_end_time', 
        'hs_created_by', 
        'hs_timestamp'
      ],
      `hs_timestamp:>${yesterday.toISOString()}`  // Filter for recently modified meetings
    );
  }

  async processIndividualMeeting(meeting) {
    // Determine action type
    const actionType = this.determineMeetingActionType(meeting);
    
    // Fetch meeting attendees (contacts)
    const attendeeEmails = await this.fetchMeetingAttendees(meeting.id);
    
    // Process each attendee
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
    // Logic to determine if this is a new or updated meeting
    const createdDate = new Date(meeting.createdAt);
    const modifiedDate = new Date(meeting.updatedAt);

    return createdDate.getTime() === modifiedDate.getTime() 
      ? 'Meeting Created' 
      : 'Meeting Updated';
  }

  async fetchMeetingAttendees(meetingId) {
    // This would typically involve a separate API call or database lookup
    // For this implementation, we'll use a hypothetical method
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